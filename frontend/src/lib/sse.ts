export type SSEMessage = {
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
