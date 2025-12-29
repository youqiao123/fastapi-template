import { useCallback, useEffect, useRef, useState } from "react"
import { CancelError } from "@/client"
import { ChatPanel, type ChatMessage } from "@/components/Workspace/ChatPanel"
import ChatInput from "@/components/Workspace/ChatInput"
import { apiBase } from "@/lib/api"
import { listMessages, type MessageItem } from "@/lib/messages"
import { getSSEText, readSSE } from "@/lib/sse"

const normalizeRole = (role: string): ChatMessage["role"] => {
  if (role === "user" || role === "assistant" || role === "system") {
    return role
  }
  return "assistant"
}

const mapHistoryMessages = (items: MessageItem[], threadId: string) =>
  items.map((item, index) => ({
    id: `${threadId}-${index}`,
    role: normalizeRole(item.role),
    content: item.content,
    status: "done" as const,
  }))

type ChatPanelContainerProps = {
  threadId?: string
}

export function ChatPanelContainer({ threadId }: ChatPanelContainerProps) {
  const activeThreadId = threadId
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const assistantMessageIdRef = useRef<string | null>(null)
  const historyRequestRef = useRef<ReturnType<typeof listMessages> | null>(null)

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

  const appendAssistantDelta = useCallback((delta: string) => {
    const targetId = assistantMessageIdRef.current
    if (!targetId) {
      return
    }
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

      setIsStreaming(true)
      setStatus("connecting")
      setError(null)

      const timestamp = Date.now()
      const userMessageId = `user-${timestamp}`
      const assistantMessageId = `assistant-${timestamp}`
      assistantMessageIdRef.current = assistantMessageId

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

      const url = `${apiBase}/api/v1/chat/stream?q=${encodeURIComponent(message)}&thread_id=${encodeURIComponent(activeThreadId)}`
      const token = localStorage.getItem("access_token") ?? ""
      let didError = false

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
          if (message.event === "status") {
            try {
              const payload = JSON.parse(message.data)
              setStatus(payload?.phase ?? "status")
            } catch {
              setStatus("status")
            }
            return
          }

          if (message.event === "done") {
            setStatus("done")
            setAssistantStatus("done")
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
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsStreaming(false)
          if (!didError) {
            setStatus("done")
            setAssistantStatus("done")
          }
        }
        assistantMessageIdRef.current = null
      }
    },
    [appendAssistantDelta, setAssistantStatus],
  )

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
  }, [activeThreadId])

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

  const statusLabel =
    status !== "idle" ? `Status: ${status}` : "Ready"

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Chat</h2>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel
          messages={messages}
          className="rounded-md border border-dashed border-border/60 bg-background/40"
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        disabled={isStreaming}
        placeholder="Ask a question..."
      />
    </section>
  )
}
