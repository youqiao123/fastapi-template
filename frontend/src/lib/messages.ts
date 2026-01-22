import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"
import { type ArtifactApiRecord } from "@/lib/artifacts"

export type MessageItem = {
  id: string
  role: string
  content: string
  created_at?: string
  run_id?: string | null
  artifacts?: ArtifactApiRecord[]
}

export const listMessages = (threadId?: string) =>
  request<MessageItem[]>(OpenAPI, {
    method: "GET",
    url: "/api/v1/messages",
    query: threadId ? { thread_id: threadId } : undefined,
  })

export type MessageCreate = {
  role: string
  content: string
  runId?: string
}

export const saveMessages = (threadId: string, messages: MessageCreate[]) =>
  request<MessageItem[]>(OpenAPI, {
    method: "POST",
    url: "/api/v1/messages",
    body: {
      thread_id: threadId,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        run_id: message.runId ?? null,
      })),
    },
    mediaType: "application/json",
  })
