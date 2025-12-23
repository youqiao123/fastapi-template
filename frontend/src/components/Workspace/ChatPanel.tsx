import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessageStatus =
  | 'pending'
  | 'streaming'
  | 'done'
  | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  status?: ChatMessageStatus
  createdAt?: number
}

export interface ChatPanelProps {
  messages: ChatMessage[]
  autoScroll?: boolean
  className?: string
}

const AUTO_SCROLL_THRESHOLD = 80

function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const isAssistant = message.role === "assistant"
  const isSystem = message.role === "system"
  const isPending = message.status === "pending"
  const isStreaming = message.status === "streaming"
  const isError = message.status === "error"

  const alignmentClass = isUser
    ? "justify-end"
    : isSystem
      ? "justify-center"
      : "justify-start"

  const bodyClass = cn(
    "flex flex-col gap-2 text-sm leading-relaxed",
    isUser
      ? "max-w-[75%] rounded-2xl border border-border/60 bg-muted/70 px-4 py-2 text-foreground"
      : isSystem
        ? "max-w-[85%] rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        : "w-full text-foreground",
    isPending && "opacity-80",
  )

  const textClass = cn(
    "whitespace-pre-wrap break-words",
    isPending && "text-muted-foreground italic",
  )

  const placeholder = !message.content && isPending ? "Preparing response..." : ""
  const content = message.content || placeholder

  return (
    <div className={cn("flex w-full items-start", alignmentClass)}>
      <div className={bodyClass}>
        {isAssistant && isStreaming ? (
          <span className="inline-flex items-center">
            <span className="size-2 animate-pulse rounded-full bg-foreground/50" />
          </span>
        ) : null}
        {content ? <p className={textClass}>{content}</p> : null}
        {isError ? (
          <div className="rounded-md border border-destructive/60 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
            Generation failed.
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ChatPanel({
  messages,
  autoScroll = true,
  className,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll)
  const manualScrollRef = useRef(false)

  const lastMessage = messages[messages.length - 1]
  const lastMessageId = lastMessage?.id
  const lastMessageContent = lastMessage?.content

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const container = scrollRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior })
      return
    }
    bottomRef.current?.scrollIntoView({ behavior, block: "end" })
  }, [])

  const handleScroll = useCallback(() => {
    if (!autoScroll) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    // Keep auto-scroll enabled only when the user is near the bottom.
    const nearBottom = distanceToBottom <= AUTO_SCROLL_THRESHOLD
    setIsAutoScrollEnabled((prev) => (prev === nearBottom ? prev : nearBottom))
  }, [autoScroll])

  useEffect(() => {
    if (!autoScroll) {
      setIsAutoScrollEnabled(false)
      return
    }

    if (!isAutoScrollEnabled) {
      return
    }

    if (manualScrollRef.current) {
      manualScrollRef.current = false
      return
    }

    scrollToBottom("auto")
  }, [
    autoScroll,
    isAutoScrollEnabled,
    lastMessageContent,
    lastMessageId,
    messages.length,
    scrollToBottom,
  ])

  const showScrollButton =
    autoScroll && !isAutoScrollEnabled && messages.length > 0

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6",
          className,
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Start a conversation by typing below.
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {showScrollButton ? (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => {
              manualScrollRef.current = true
              scrollToBottom("smooth")
              setIsAutoScrollEnabled(true)
            }}
            aria-label="Scroll to bottom"
            className="pointer-events-auto rounded-full shadow-sm"
          >
            <ChevronDown />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
