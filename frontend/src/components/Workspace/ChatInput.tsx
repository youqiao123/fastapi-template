import * as React from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask a question...",
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const MAX_TEXTAREA_HEIGHT = 80

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
    if (disabled) {
      return
    }
    const message = value.trim()
    if (!message) {
      return
    }
    onSend(message)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return
    }

    if (event.nativeEvent.isComposing || disabled) {
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
        disabled={disabled}
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
          variant="ghost"
          size="icon-sm"
          onClick={handleSend}
          disabled={disabled}
          aria-label="Send message"
          title="Send"
          className="rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <Send />
        </Button>
      </div>
    </div>
  )
}
