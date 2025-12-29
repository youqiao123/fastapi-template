import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"

import { CreateThreadDialog } from "@/components/Common/CreateThreadDialog"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import {
  createThread,
  getThreadTitle,
  listThreads,
  THREADS_QUERY_KEY,
  type ConversationThread,
} from "@/lib/threads"
import { handleError } from "@/utils"

const formatThreadTimestamp = (value?: string) => {
  if (!value) {
    return "Created just now"
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return "Created just now"
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))

  return `Created ${formatted}`
}

const getThreadInitial = (title?: string | null) => {
  const label = getThreadTitle(title).trim()
  if (!label) {
    return "?"
  }
  return label.slice(0, 1).toUpperCase()
}

const getThreadDateValue = (thread: ConversationThread) => {
  if (!thread.created_at) {
    return 0
  }

  const timestamp = Date.parse(thread.created_at)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

type ThreadCardProps = {
  thread: ConversationThread
  index: number
}

function ThreadCard({ thread, index }: ThreadCardProps) {
  const title = getThreadTitle(thread.title)
  const createdLabel = formatThreadTimestamp(thread.created_at)
  const initial = getThreadInitial(thread.title)

  return (
    <Link
      to="/workspace/$threadId"
      params={{ threadId: thread.thread_id }}
      className={cn(
        "group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[24px] border border-border/60 bg-background/80 p-6 text-left shadow-sm transition will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-muted/30",
        "animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
        "hover:-translate-y-1 hover:border-foreground/20 hover:shadow-md",
      )}
      style={{ animationDelay: `${140 + index * 80}ms` }}
    >
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-2xl bg-background/70 text-base font-semibold shadow-sm backdrop-blur-sm dark:bg-white/10",
              "text-foreground",
            )}
          >
            {initial}
          </span>
          <span className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground/70">
            Thread
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-snug text-foreground line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground/80">{createdLabel}</p>
        </div>
      </div>
    </Link>
  )
}

export function WorkspaceIndexPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: THREADS_QUERY_KEY,
    queryFn: listThreads,
  })

  const createThreadMutation = useMutation({
    mutationFn: (title: string) => createThread({ title }),
    onSuccess: (thread) => {
      showSuccessToast("Thread created")
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
      setIsCreateDialogOpen(false)
      if (thread?.thread_id) {
        navigate({
          to: "/workspace/$threadId",
          params: { threadId: thread.thread_id },
        })
      } else {
        navigate({ to: "/workspace" })
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const threads = useMemo(() => {
    const items = (data?.data ?? []).filter(
      (thread) => thread.thread_id && thread.user_id,
    )
    return items.sort((a, b) => getThreadDateValue(b) - getThreadDateValue(a))
  }, [data])

  const totalThreads = data?.count ?? threads.length
  const isCreatingThread = createThreadMutation.isPending

  return (
    <section
      className="workspace-shell relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/60 bg-muted/20 p-6 shadow-sm dark:bg-muted/15"
    >
      <div className="relative flex min-h-0 flex-1 flex-col gap-6">
        <header className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-top-3 duration-500">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Conversation Threads
              </h2>
            </div>
            <div className="text-xs text-muted-foreground/80">
              {totalThreads} threads
            </div>
          </div>
          {isError ? (
            <p className="text-xs font-medium text-destructive">
              Failed to load threads. Try again soon.
            </p>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid auto-rows-[minmax(220px,_1fr)] gap-6 pb-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isCreatingThread}
              aria-busy={isCreatingThread}
              className={cn(
                "group relative flex min-h-[220px] flex-col items-center justify-center gap-4 overflow-hidden rounded-[24px] border border-dashed border-border/70 bg-background/80 p-6 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-muted/20",
                "animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                "hover:-translate-y-1 hover:border-foreground/30 hover:shadow-md",
                "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0",
              )}
              style={{ animationDelay: "60ms" }}
            >
              <div className="relative z-10 flex flex-col items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-sm dark:bg-white/10">
                  <Plus className="size-6" />
                </span>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {isCreatingThread ? "Creating..." : "New thread"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isCreatingThread
                      ? "Hang tight while we set things up."
                      : "Start a fresh conversation."}
                  </p>
                </div>
              </div>
            </button>
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex min-h-[220px] flex-col justify-between rounded-[24px] border border-border/50 bg-muted/20 p-6 shadow-sm"
                  >
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))
              : threads.map((thread, index) => (
                  <ThreadCard
                    key={thread.thread_id}
                    thread={thread}
                    index={index}
                  />
                ))}
            {!isLoading && threads.length === 0 ? (
              <div className="col-span-full flex min-h-[160px] flex-col items-start justify-center gap-2 rounded-[24px] border border-border/50 bg-background/60 p-6 text-sm text-muted-foreground shadow-sm">
                <p className="text-base font-semibold text-foreground">
                  No threads yet.
                </p>
                <p>Use the card above to create your first conversation.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <CreateThreadDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        isSubmitting={createThreadMutation.isPending}
        onConfirm={(title) => createThreadMutation.mutate(title)}
      />
    </section>
  )
}
