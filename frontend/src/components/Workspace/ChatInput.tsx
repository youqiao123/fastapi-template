import * as React from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const StopIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <circle cx="12" cy="12" r="6.5" />
  </svg>
)

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
  isStopping?: boolean
  canStop?: boolean
  placeholder?: string
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  isStopping = false,
  canStop = false,
  placeholder = "Ask a question...",
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const MAX_TEXTAREA_HEIGHT = 80
  const isStopMode = Boolean(onStop) && isStreaming && canStop
  const hasMessage = value.trim().length > 0
  const isInputDisabled = disabled || isStreaming
  const buttonDisabled = isStopMode
    ? isStopping
    : disabled || isStreaming || !hasMessage

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden"
  }, [MAX_TEXTAREA_HEIGHT])

  React.useEffect(() => {
    resizeTextarea()
  }, [value, resizeTextarea])

  const handleSend = () => {
    if (disabled || isStreaming) {
      return
    }
    const message = value.trim()
    if (!message) {
      return
    }
    onSend(message)
  }

  const handleStop = () => {
    if (!isStopMode || buttonDisabled) {
      return
    }
    onStop?.()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isStopMode) {
      return
    }

    if (event.nativeEvent.isComposing || disabled || isStreaming) {
      return
    }

    event.preventDefault()
    handleSend()
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-input bg-background/60 px-3 py-2 shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-input/30",
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isInputDisabled}
        rows={1}
        aria-label="Chat message"
        className={cn(
          "chat-input-textarea flex w-full min-h-[36px] resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground",
          "selection:bg-primary selection:text-primary-foreground",
        )}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant={isStopMode ? "destructive" : "ghost"}
          size="icon-sm"
          onClick={isStopMode ? handleStop : handleSend}
          disabled={buttonDisabled}
          aria-label={isStopMode ? "Stop response" : "Send message"}
          title={isStopMode ? (isStopping ? "Stopping..." : "Stop") : "Send"}
          className={cn(
            "rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            isStopMode && "text-primary-foreground",
          )}
        >
          {isStopMode ? (
            <StopIcon className="size-4 fill-current" />
          ) : (
            <Send />
          )}
        </Button>
      </div>
    </div>
  )
}
