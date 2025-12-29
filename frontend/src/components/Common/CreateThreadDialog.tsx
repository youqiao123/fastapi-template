import { useEffect, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type CreateThreadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: string) => void
  isSubmitting?: boolean
}

export function CreateThreadDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: CreateThreadDialogProps) {
  const [title, setTitle] = useState("")
  useEffect(() => {
    if (!open) {
      setTitle("")
      return
    }
  }, [open])

  const trimmedTitle = title.trim()
  const canSubmit = trimmedTitle.length > 0 && !isSubmitting

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    onConfirm(trimmedTitle)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Name your thread</DialogTitle>
          <DialogDescription>
            Give this conversation a clear, memorable title.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Launch checklist"
            maxLength={255}
            aria-label="Thread name"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Creating..." : "Create thread"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
