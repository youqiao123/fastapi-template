import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type MessageItem = {
  role: string
  content: string
}

export const listMessages = (threadId?: string) =>
  request<MessageItem[]>(OpenAPI, {
    method: "GET",
    url: "/api/v1/messages",
    query: threadId ? { thread_id: threadId } : undefined,
  })
