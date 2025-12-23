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
