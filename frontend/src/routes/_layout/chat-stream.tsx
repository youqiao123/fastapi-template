import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SSEMessage = {
  event: string
  data: string
  id?: string
}

const parseSSEMessage = (raw: string): SSEMessage | null => {
  let event = "message"
  let id: string | undefined
  const dataLines: string[] = []

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trimEnd()
    if (!line || line.startsWith(":")) {
      continue
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart())
      continue
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trim()
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  return {
    event,
    data: dataLines.join("\n"),
    id,
  }
}

async function readSSE(
  body: ReadableStream<Uint8Array> | null,
  onMessage: (message: SSEMessage) => void,
) {
  if (!body) {
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""

    for (const part of parts) {
      const message = parseSSEMessage(part)
      if (message) {
        onMessage(message)
      }
    }
  }

  if (buffer.trim()) {
    const message = parseSSEMessage(buffer)
    if (message) {
      onMessage(message)
    }
  }
}

export const Route = createFileRoute("/_layout/chat-stream")({
  component: ChatStream,
  head: () => ({
    meta: [
      {
        title: "Chat Stream - FastAPI Cloud",
      },
    ],
  }),
})

function ChatStream() {
  const [query, setQuery] = useState("hello")
  const [output, setOutput] = useState("")
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const handleSend = async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setIsStreaming(true)
    setOutput("")
    setStatus("connecting")
    setError(null)

    const apiBase = import.meta.env.VITE_API_URL ?? ""
    const url = `${apiBase}/api/v1/chat/stream?q=${encodeURIComponent(query)}`
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
        const message = await response.text()
        setStatus("error")
        setError(message || `Request failed with ${response.status}`)
        setIsStreaming(false)
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

        if (message.event === "token") {
          let delta = message.data
          try {
            const payload = JSON.parse(message.data)
            if (typeof payload?.delta === "string") {
              delta = payload.delta
            }
          } catch {
            // fall back to raw data
          }
          setOutput((prev) => prev + delta)
          setStatus("streaming")
          return
        }

        if (message.event === "done") {
          setStatus("done")
        }
      })
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Unknown error")
      }
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask something..."
        />
        <Button onClick={handleSend} disabled={isStreaming || !query.trim()}>
          {isStreaming ? "Streaming..." : "Send"}
        </Button>
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Status: {status}</span>
          <span>Base URL: {import.meta.env.VITE_API_URL || "(same origin)"}</span>
        </div>
        {error ? (
          <div className="mt-3 text-sm text-destructive">{error}</div>
        ) : (
          <div className="mt-3 min-h-40 whitespace-pre-wrap font-mono text-sm">
            {output || "No output yet."}
          </div>
        )}
      </div>
    </div>
  )
}
