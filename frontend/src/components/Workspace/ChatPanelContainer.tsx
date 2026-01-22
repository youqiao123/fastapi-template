import { useCallback, useEffect, useRef, useState } from "react"
import { CancelError } from "@/client"
import {
  ChatPanel,
  type AgentRunState,
  type ChatMessage,
} from "@/components/Workspace/ChatPanel"
import ChatInput from "@/components/Workspace/ChatInput"
import { apiBase } from "@/lib/api"
import { saveArtifacts, toDisplayArtifact } from "@/lib/artifacts"
import {
  listMessages,
  saveMessages,
  type MessageCreate,
  type MessageItem,
} from "@/lib/messages"
import { getSSEText, readSSE, type SSEMessage } from "@/lib/sse"
import { type ArtifactDisplay, type ArtifactItem } from "@/types/artifact"

const normalizeRole = (role: string): ChatMessage["role"] => {
  if (role === "user" || role === "assistant" || role === "system") {
    return role
  }
  return "assistant"
}

const mapHistoryMessages = (items: MessageItem[], threadId: string) =>
  items.map((item, index) => {
    const createdAt = item.created_at
      ? Date.parse(item.created_at)
      : undefined
    const artifacts = Array.isArray(item.artifacts)
      ? item.artifacts.map(toDisplayArtifact)
      : []
    return {
      id: item.id ?? `${threadId}-${index}`,
      role: normalizeRole(item.role),
      content: item.content,
      status: "done" as const,
      createdAt: Number.isNaN(createdAt ?? 0) ? undefined : createdAt,
      artifacts,
    }
  })

type ArtifactUpdateOptions = {
  replace?: boolean
}

type ChatPanelContainerProps = {
  threadId?: string
  onArtifactsUpdate?: (
    artifacts: ArtifactDisplay[],
    options?: ArtifactUpdateOptions,
  ) => void
  onArtifactsView?: (artifacts: ArtifactDisplay[]) => void
}

export function ChatPanelContainer({
  threadId,
  onArtifactsUpdate,
  onArtifactsView,
}: ChatPanelContainerProps) {
  const activeThreadId = threadId
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRunState>>({})
  const [agentTimerStart, setAgentTimerStart] = useState<number | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const assistantMessageIdRef = useRef<string | null>(null)
  const activeRunIdRef = useRef<string | null>(null)
  const historyRequestRef = useRef<ReturnType<typeof listMessages> | null>(null)
  const artifactKeysRef = useRef<Set<string>>(new Set())
  const pendingArtifactsRef = useRef<ArtifactItem[]>([])
  const assistantContentRef = useRef("")
  const stopRequestedRef = useRef(false)

  const setAssistantStatus = useCallback((nextStatus: ChatMessage["status"]) => {
    const targetId = assistantMessageIdRef.current
    if (!targetId) {
      return
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId ? { ...message, status: nextStatus } : message,
      ),
    )
  }, [])

  const safeParsePayload = (raw: string): Record<string, unknown> | null => {
    if (!raw) {
      return null
    }
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // ignore invalid JSON
    }
    return null
  }

  const toArtifactItem = (value: unknown, runId?: string): ArtifactItem | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null
    }
    const candidate = value as Record<string, unknown>
    const type = candidate["type"]
    const path = candidate["path"]
    const assetId = candidate["asset_id"]
    const isFolder = candidate["is_folder"]
    const runIdValue =
      typeof candidate["run_id"] === "string" ? candidate["run_id"] : runId

    if (
      typeof type !== "string" ||
      typeof path !== "string" ||
      typeof assetId !== "string"
    ) {
      return null
    }

    return {
      type,
      path,
      assetId,
      isFolder: typeof isFolder === "boolean" ? isFolder : false,
      runId: runIdValue,
    }
  }

  const parseArtifactsFromMessage = (message: SSEMessage): ArtifactItem[] => {
    const payload = message.payload ?? safeParsePayload(message.data)
    const artifactsValue = payload?.["artifacts"]
    if (!Array.isArray(artifactsValue)) {
      return []
    }
    const payloadRunId =
      typeof payload?.["run_id"] === "string" ? payload["run_id"] : undefined
    const runId = payloadRunId ?? activeRunIdRef.current ?? undefined
    return artifactsValue
      .map((artifact) => toArtifactItem(artifact, runId))
      .filter((item): item is ArtifactItem => Boolean(item))
  }

  const persistMessages = useCallback(
    async (threadId: string, messages: MessageCreate[]) => {
      if (!messages.length) {
        return []
      }
      try {
        return await saveMessages(threadId, messages)
      } catch (err) {
        console.error("Failed to persist messages", err)
        return []
      }
    },
    [],
  )

  const persistArtifacts = useCallback(
    async (artifacts: ArtifactItem[]) => {
      if (!artifacts.length || !activeThreadId) {
        return []
      }
      try {
        return await saveArtifacts(artifacts, activeThreadId)
      } catch (err) {
        console.error("Failed to persist artifacts", err)
        return artifacts
      }
    },
    [activeThreadId],
  )

  const getArtifactKey = useCallback(
    (artifact: Pick<ArtifactItem, "assetId" | "path">) =>
      `${artifact.assetId}-${artifact.path}`,
    [],
  )

  const mergeArtifactsByKey = useCallback(
    (current: ArtifactDisplay[] = [], incoming: ArtifactDisplay[]) => {
      const merged = [...incoming, ...current]
      const seen = new Set<string>()
      const unique: ArtifactDisplay[] = []

      for (const artifact of merged) {
        const key = getArtifactKey(artifact)
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        unique.push(artifact)
      }

      return unique
    },
    [getArtifactKey],
  )

  const attachArtifactsToMessage = useCallback(
    (messageId: string | null, artifacts: ArtifactDisplay[]) => {
      if (!messageId || !artifacts.length) {
        return
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                artifacts: mergeArtifactsByKey(message.artifacts, artifacts),
              }
            : message,
        ),
      )
    },
    [mergeArtifactsByKey],
  )

  const registerArtifacts = useCallback(
    async (
      artifacts: ArtifactItem[],
      options?: { messageId?: string },
    ) => {
      if (!artifacts.length) {
        return
      }

      const unique = artifacts.filter((artifact) => {
        const key = getArtifactKey(artifact)
        if (artifactKeysRef.current.has(key)) {
          return false
        }
        artifactKeysRef.current.add(key)
        return true
      })

      if (!unique.length) {
        return
      }

      onArtifactsUpdate?.(unique, { replace: false })
      attachArtifactsToMessage(options?.messageId ?? null, unique)
      const ready = unique.filter((artifact) => Boolean(artifact.runId))
      const pending = unique.filter((artifact) => !artifact.runId)
      if (pending.length) {
        pendingArtifactsRef.current = [
          ...pendingArtifactsRef.current,
          ...pending,
        ]
      }
      if (!ready.length) {
        return
      }
      const saved = await persistArtifacts(ready)
      if (saved.length) {
        onArtifactsUpdate?.(saved, { replace: false })
        attachArtifactsToMessage(options?.messageId ?? null, saved)
      }
    },
    [attachArtifactsToMessage, getArtifactKey, persistArtifacts, onArtifactsUpdate],
  )

  const flushPendingArtifacts = useCallback(
    async (runId: string) => {
      const pending = pendingArtifactsRef.current
      if (!pending.length) {
        return
      }
      pendingArtifactsRef.current = []
      const hydrated = pending.map((artifact) => ({ ...artifact, runId }))
      const saved = await persistArtifacts(hydrated)
      if (saved.length) {
        onArtifactsUpdate?.(saved, { replace: false })
        attachArtifactsToMessage(assistantMessageIdRef.current, saved)
      }
    },
    [attachArtifactsToMessage, onArtifactsUpdate, persistArtifacts],
  )

  const getToolNameFromMessage = (message: SSEMessage): string | null => {
    const payload = message.payload ?? safeParsePayload(message.data)
    const tool = payload?.["tool"]
    return typeof tool === "string" ? tool : null
  }

  const getRunIdFromMessage = (message: SSEMessage): string | null => {
    const payload = message.payload ?? safeParsePayload(message.data)
    const runId = payload?.["run_id"]
    return typeof runId === "string" ? runId : null
  }

  const beginAgentRun = useCallback((messageId: string) => {
    setAgentTimerStart(null)
    setAgentRuns((prev) => ({
      ...prev,
      [messageId]: {
        messageId,
        steps: [],
        elapsedSeconds: 0,
        isActive: true,
      },
    }))
  }, [])

  const handleToolStart = useCallback(
    (toolName: string) => {
      const messageId = assistantMessageIdRef.current
      if (!messageId) {
        return
      }

      setAgentTimerStart((current) => current ?? Date.now())
      setAgentRuns((prev) => {
        const currentRun =
          prev[messageId] ?? {
            messageId,
            steps: [],
            elapsedSeconds: 0,
            isActive: true,
          }
        return {
          ...prev,
          [messageId]: {
            ...currentRun,
            isActive: true,
            steps: [
              ...currentRun.steps,
              {
                id: `${Date.now()}-${currentRun.steps.length + 1}`,
                name: toolName,
                status: "running",
              },
            ],
          },
        }
      })
      setAssistantStatus("streaming")
    },
    [setAssistantStatus],
  )

  const handleToolEnd = useCallback((toolName: string | null) => {
    const messageId = assistantMessageIdRef.current
    if (!messageId) {
      return
    }
    setAgentRuns((prev) => {
      const currentRun = prev[messageId]
      if (!currentRun || currentRun.steps.length === 0) {
        return prev
      }
      const nextSteps = [...currentRun.steps]
      for (let index = nextSteps.length - 1; index >= 0; index -= 1) {
        const step = nextSteps[index]
        const matches = !toolName || step.name === toolName
        if (step.status === "running" && matches) {
          nextSteps[index] = { ...step, status: "done" }
          return {
            ...prev,
            [messageId]: { ...currentRun, steps: nextSteps },
          }
        }
      }
      return prev
    })
  }, [])

  const updateElapsedForCurrentRun = useCallback(() => {
    const messageId = assistantMessageIdRef.current
    if (!messageId || agentTimerStart === null) {
      return
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - agentTimerStart) / 1000),
    )

    setAgentRuns((prev) => {
      const currentRun = prev[messageId]
      if (!currentRun || currentRun.elapsedSeconds === elapsedSeconds) {
        return prev
      }
      return {
        ...prev,
        [messageId]: { ...currentRun, elapsedSeconds },
      }
    })
  }, [agentTimerStart])

  const markAgentRunInactive = useCallback((messageId: string) => {
    setAgentRuns((prev) => {
      const currentRun = prev[messageId]
      if (!currentRun) {
        return prev
      }
      return {
        ...prev,
        [messageId]: { ...currentRun, isActive: false },
      }
    })
  }, [])

  const appendAssistantDelta = useCallback((delta: string) => {
    const targetId = assistantMessageIdRef.current
    if (!targetId) {
      return
    }
    assistantContentRef.current = `${assistantContentRef.current}${delta}`
    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId
          ? {
              ...message,
              content: `${message.content}${delta}`,
              status: "streaming",
            }
          : message,
      ),
    )
  }, [])

  const startStream = useCallback(
    async (activeThreadId: string, message: string) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      artifactKeysRef.current = new Set()
      pendingArtifactsRef.current = []
      assistantContentRef.current = ""
      activeRunIdRef.current = null
      setActiveRunId(null)
      stopRequestedRef.current = false
      setIsStopping(false)

      setIsStreaming(true)
      setStatus("connecting")
      setError(null)
      onArtifactsUpdate?.([], { replace: true })

      const timestamp = Date.now()
      const userMessageId = `user-${timestamp}`
      const assistantMessageId = `assistant-${timestamp}`
      assistantMessageIdRef.current = assistantMessageId
      beginAgentRun(assistantMessageId)

      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user",
          content: message,
          status: "done",
          createdAt: timestamp,
        },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          status: "pending",
          createdAt: timestamp,
        },
      ])

      void persistMessages(activeThreadId, [
        { role: "user", content: message },
      ])

      const url = `${apiBase}/api/v1/chat/stream?q=${encodeURIComponent(message)}&thread_id=${encodeURIComponent(activeThreadId)}`
      const token = localStorage.getItem("access_token") ?? ""
      let didError = false
      let completionReason: "done" | "aborted" | "error" | null = null

      try {
        const response = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          didError = true
          setStatus("error")
          setError(errorText || `Request failed with ${response.status}`)
          setAssistantStatus("error")
          return
        }

        await readSSE(response.body, (message) => {
          const artifacts = parseArtifactsFromMessage(message)
          if (artifacts.length) {
            const shouldAttachToMessage = message.event === "done"
            void registerArtifacts(artifacts, {
              messageId: shouldAttachToMessage ? assistantMessageId : undefined,
            })
          }

          if (message.event === "status") {
            try {
              const payload = JSON.parse(message.data)
              setStatus(payload?.phase ?? "status")
            } catch {
              setStatus("status")
            }
            return
          }

          if (message.event === "run_id") {
            const runId = getRunIdFromMessage(message)
            if (runId) {
              activeRunIdRef.current = runId
              setActiveRunId(runId)
              void flushPendingArtifacts(runId)
            }
            return
          }

          if (message.event === "aborted") {
            const runId = getRunIdFromMessage(message)
            if (!activeRunIdRef.current || !runId || runId === activeRunIdRef.current) {
              completionReason = "aborted"
              stopRequestedRef.current = true
              setStatus("aborted")
              setAssistantStatus("aborted")
              markAgentRunInactive(assistantMessageId)
              controller.abort()
            }
            return
          }

          if (message.event === "done") {
            const runId =
              activeRunIdRef.current ?? getRunIdFromMessage(message) ?? undefined
            if (runId) {
              void flushPendingArtifacts(runId)
            }
            if (assistantContentRef.current) {
              void persistMessages(activeThreadId, [
                {
                  role: "assistant",
                  content: assistantContentRef.current,
                  runId,
                },
              ])
            }
            updateElapsedForCurrentRun()
            setStatus("done")
            setAssistantStatus("done")
            markAgentRunInactive(assistantMessageId)
            completionReason = completionReason ?? "done"
            return
          }

          if (message.event === "on_tool_start") {
            const toolName = getToolNameFromMessage(message)
            if (toolName) {
              handleToolStart(toolName)
            }
            return
          }

          if (message.event === "on_tool_end") {
            const toolName = getToolNameFromMessage(message)
            handleToolEnd(toolName)
            return
          }

          const delta = getSSEText(message)
          if (!delta) {
            return
          }
          appendAssistantDelta(delta)
          setStatus("streaming")
        })
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          didError = true
          setStatus("error")
          setError(err instanceof Error ? err.message : "Unknown error")
          setAssistantStatus("error")
          completionReason = "error"
        }
      } finally {
        const wasAborted = controller.signal.aborted
        const resolvedReason: "done" | "error" | "aborted" =
          completionReason ??
          (didError ? "error" : null) ??
          (stopRequestedRef.current || wasAborted ? "aborted" : null) ??
          "done"

        updateElapsedForCurrentRun()
        markAgentRunInactive(assistantMessageId)
        setIsStreaming(false)
        setAgentTimerStart(null)
        setActiveRunId(null)
        activeRunIdRef.current = null
        setIsStopping(false)
        stopRequestedRef.current = false

        if (resolvedReason === "error") {
          setStatus("error")
          setAssistantStatus("error")
        } else if (resolvedReason === "aborted") {
          setStatus("aborted")
          setAssistantStatus("aborted")
        } else if (!didError) {
          setStatus("done")
          setAssistantStatus("done")
        }
        if (assistantMessageIdRef.current === assistantMessageId) {
          assistantMessageIdRef.current = null
        }
      }
    },
    [
      appendAssistantDelta,
      beginAgentRun,
      markAgentRunInactive,
      handleToolEnd,
      handleToolStart,
      flushPendingArtifacts,
      persistMessages,
      registerArtifacts,
      getRunIdFromMessage,
      onArtifactsUpdate,
      setAssistantStatus,
      updateElapsedForCurrentRun,
    ],
  )

  useEffect(() => {
    if (!isStreaming || agentTimerStart === null) {
      return
    }

    updateElapsedForCurrentRun()
    const timerId = window.setInterval(updateElapsedForCurrentRun, 1000)
    return () => window.clearInterval(timerId)
  }, [agentTimerStart, isStreaming, updateElapsedForCurrentRun])

  useEffect(() => {
    if (!isStreaming) {
      setAgentTimerStart(null)
    }
  }, [isStreaming])

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  useEffect(() => {
    controllerRef.current?.abort()
    assistantMessageIdRef.current = null
    setMessages([])
    setStatus("idle")
    setError(null)
    setIsStreaming(false)
    setIsStopping(false)
    setAgentRuns({})
    setAgentTimerStart(null)
    setActiveRunId(null)
    activeRunIdRef.current = null
    pendingArtifactsRef.current = []
    assistantContentRef.current = ""
    stopRequestedRef.current = false
    artifactKeysRef.current = new Set()
    onArtifactsUpdate?.([], { replace: true })
  }, [activeThreadId, onArtifactsUpdate])

  useEffect(() => {
    if (!activeThreadId) {
      return
    }

    historyRequestRef.current?.cancel()
    const request = listMessages(activeThreadId)
    historyRequestRef.current = request
    setStatus("loading history")
    setError(null)
    let isActive = true

    request
      .then((items) => {
        if (!isActive) {
          return
        }
        const history = mapHistoryMessages(items, activeThreadId)
        setMessages((prev) => (prev.length ? [...history, ...prev] : history))
        setStatus((prev) => (prev === "loading history" ? "idle" : prev))
      })
      .catch((err) => {
        if (!isActive || err instanceof CancelError) {
          return
        }
        setStatus((prev) => (prev === "loading history" ? "error" : prev))
        setError(err instanceof Error ? err.message : "Unknown error")
      })

    return () => {
      isActive = false
      request.cancel()
    }
  }, [activeThreadId])

  const stopActiveRun = useCallback(async () => {
    if (!isStreaming || isStopping) {
      return
    }
    const runId = activeRunIdRef.current
    if (!runId) {
      return
    }

    stopRequestedRef.current = true
    setIsStopping(true)
    setStatus("stopping")
    setAssistantStatus("aborted")
    const assistantId = assistantMessageIdRef.current
    if (assistantId) {
      markAgentRunInactive(assistantId)
    }
    controllerRef.current?.abort()

    const token = localStorage.getItem("access_token") ?? ""
    try {
      await fetch(`${apiBase}/agent/chat/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ run_id: runId }),
      })
    } catch (err) {
      console.error("Failed to stop agent run", err)
    } finally {
      setIsStopping(false)
    }
  }, [isStreaming, isStopping, markAgentRunInactive, setAssistantStatus, setStatus])

  const handleSend = async (message: string) => {
    if (isStreaming) {
      return
    }
    if (!activeThreadId) {
      setStatus("error")
      setError("Please create a thread before sending a message.")
      return
    }

    setDraft("")
    void startStream(activeThreadId, message)
  }

  const statusLabel = status !== "idle" ? `Status: ${status}` : "Ready"

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Chat</h2>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel
          messages={messages}
          agentRuns={agentRuns}
          className="rounded-md border border-dashed border-border/60 bg-background/40"
          onShowArtifacts={onArtifactsView}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        onStop={stopActiveRun}
        isStreaming={isStreaming}
        isStopping={isStopping}
        canStop={Boolean(activeRunId)}
        placeholder="Ask a question..."
      />
    </section>
  )
}
