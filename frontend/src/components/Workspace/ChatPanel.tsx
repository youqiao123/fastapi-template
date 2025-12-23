import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"

import ChatInput from "@/components/Workspace/ChatInput"
import { readSSE } from "@/lib/sse"
import { createThread, THREADS_QUERY_KEY } from "@/lib/threads"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

const PENDING_MESSAGE_KEY = "workspace.pending-message"

const parseDelta = (raw: string) => {
  try {
    const payload = JSON.parse(raw)
    if (typeof payload?.delta === "string") {
      return payload.delta
    }
  } catch {
    // fall back to raw data
  }
  return raw
}

type ChatPanelProps = {
  threadId?: string
}

export function ChatPanel({ threadId }: ChatPanelProps) {
  const routeThreadId = useRouterState({
    select: (state) => {
      const matches = [...state.matches].reverse()
      for (const match of matches) {
        if (typeof match.params?.threadId === "string") {
          return match.params.threadId
        }
      }
      return undefined
    },
  })
  const activeThreadId = threadId ?? routeThreadId
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const assistantMessageIdRef = useRef<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const appendAssistantDelta = useCallback((delta: string) => {
    const targetId = assistantMessageIdRef.current
    if (!targetId) {
      return
    }
    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId
          ? { ...message, content: `${message.content}${delta}` }
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
        { id: userMessageId, role: "user", content: message },
        { id: assistantMessageId, role: "assistant", content: "" },
      ])

      const apiBase = import.meta.env.VITE_API_URL ?? ""
      const url = `${apiBase}/api/v1/chat/stream?q=${encodeURIComponent(message)}&thread_id=${encodeURIComponent(activeThreadId)}`
      const token = localStorage.getItem("access_token") ?? ""

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
          setStatus("error")
          setError(errorText || `Request failed with ${response.status}`)
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
            return
          }

          const delta = parseDelta(message.data)
          appendAssistantDelta(delta)
          setStatus("streaming")
        })
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStatus("error")
          setError(err instanceof Error ? err.message : "Unknown error")
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsStreaming(false)
          setStatus((prev) => (prev === "error" ? prev : "done"))
        }
      }
    },
    [appendAssistantDelta],
  )

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  useEffect(() => {
    controllerRef.current?.abort()
    setMessages([])
    setStatus("idle")
    setError(null)
    setIsStreaming(false)
  }, [activeThreadId])

  useEffect(() => {
    if (!activeThreadId) {
      return
    }
    const pendingRaw = sessionStorage.getItem(PENDING_MESSAGE_KEY)
    if (!pendingRaw) {
      return
    }
    try {
      const pending = JSON.parse(pendingRaw) as {
        threadId: string
        message: string
      }
      if (pending.threadId !== activeThreadId || !pending.message) {
        return
      }
      sessionStorage.removeItem(PENDING_MESSAGE_KEY)
      void startStream(activeThreadId, pending.message)
    } catch {
      sessionStorage.removeItem(PENDING_MESSAGE_KEY)
    }
  }, [activeThreadId, startStream])

  const handleSend = async (message: string) => {
    if (isStreaming || isCreatingThread) {
      return
    }
    if (!activeThreadId) {
      setIsCreatingThread(true)
      setError(null)
      try {
        const thread = await createThread()
        const newThreadId = thread?.thread_id
        if (!newThreadId) {
          throw new Error("Failed to create thread")
        }
        queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
        sessionStorage.setItem(
          PENDING_MESSAGE_KEY,
          JSON.stringify({ threadId: newThreadId, message }),
        )
        navigate({ to: `/workspace/${newThreadId}` })
        setDraft("")
      } catch (err) {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setIsCreatingThread(false)
      }
      return
    }

    setDraft("")
    void startStream(activeThreadId, message)
  }

  const statusLabel = isCreatingThread
    ? "Creating thread..."
    : status !== "idle"
      ? `Status: ${status}`
      : "Ready"

  return (
    <section className="flex h-full flex-col gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Chat</h2>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            No messages yet.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2 text-sm",
                message.role === "user"
                  ? "bg-background/80"
                  : "bg-muted/40",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {message.content ||
                  (message.role === "assistant" && isStreaming ? "..." : "")}
              </p>
            </div>
          ))
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        disabled={isStreaming || isCreatingThread}
        placeholder="Ask a question..."
      />
    </section>
  )
}
