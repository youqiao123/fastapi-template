import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import { getThreadTitle, listThreads, THREADS_QUERY_KEY } from "@/lib/threads"

export function ThreadPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: THREADS_QUERY_KEY,
    queryFn: listThreads,
  })

  const threads = (data?.data ?? []).filter(
    (thread) => thread.thread_id && thread.user_id,
  )

  return (
    <section className="flex h-full flex-col gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Threads</h2>
        <span className="text-xs text-muted-foreground">
          {data?.count ?? threads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))
        ) : isError ? (
          <p className="text-xs text-destructive">Failed to load threads.</p>
        ) : threads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No threads yet.</p>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.thread_id}
              className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/60 px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">
                {getThreadTitle(thread.title)}
              </span>
              <span className="text-xs text-muted-foreground truncate font-mono">
                {thread.thread_id}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                User {thread.user_id}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
