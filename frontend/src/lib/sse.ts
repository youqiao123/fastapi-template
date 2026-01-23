type SSEPayload = Record<string, unknown>

export type SSEMessage = {
  event: string
  data: string
  id?: string
  payload?: SSEPayload
}

const parseJSONPayload = (raw: string): SSEPayload | null => {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SSEPayload
    }
  } catch {
    // ignore invalid JSON
  }
  return null
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

  const data = dataLines.join("\n")
  const payload = parseJSONPayload(data) ?? undefined

  return {
    event,
    data,
    id,
    payload,
  }
}

export const getSSEText = (message: SSEMessage): string | null => {
  const payload = message.payload ?? parseJSONPayload(message.data)

  if (message.event === "analysis_token") {
    return null
  }

  if (message.event === "token") {
    return typeof payload?.token === "string" ? payload.token : null
  }

  if (message.event === "on_tool_start" || message.event === "on_tool_end") {
    return null
  }

  if (typeof payload?.delta === "string") {
    return payload.delta
  }

  return message.data
}

export async function readSSE(
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
