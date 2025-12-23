import { OpenAPI } from "@/client"
import { request } from "@/client/core/request"

export type ConversationThread = {
  thread_id: string
  user_id: string
  title?: string | null
  status?: string
  created_at?: string
  updated_at?: string
}

export type ConversationThreadsResponse = {
  data: ConversationThread[]
  count: number
}

export const THREADS_QUERY_KEY = ["threads"] as const

export const getThreadTitle = (title?: string | null) => {
  if (title && title.trim().length > 0) {
    return title
  }
  return "conversation"
}

export const listThreads = () =>
  request<ConversationThreadsResponse>(OpenAPI, {
    method: "GET",
    url: "/api/v1/threads",
  })

export const createThread = () =>
  request<ConversationThread>(OpenAPI, {
    method: "POST",
    url: "/api/v1/threads",
  })

export type ConversationThreadUpdate = {
  title?: string | null
}

export const updateThread = (
  threadId: string,
  data: ConversationThreadUpdate,
) =>
  request<ConversationThread>(OpenAPI, {
    method: "PATCH",
    url: `/api/v1/threads/${threadId}`,
    body: data,
    mediaType: "application/json",
  })

export const archiveThread = (threadId: string) =>
  request<ConversationThread>(OpenAPI, {
    method: "POST",
    url: `/api/v1/threads/${threadId}/archive`,
  })

export const deleteThread = (threadId: string) =>
  request<ConversationThread>(OpenAPI, {
    method: "DELETE",
    url: `/api/v1/threads/${threadId}`,
  })
