import { cn } from "@/lib/utils"

type ArtifactPanelProps = {
  className?: string
}

export function ArtifactPanel({ className }: ArtifactPanelProps) {
  return (
    <section className={cn("flex min-h-0 flex-col gap-2", className)}>
      <h2 className="text-sm font-semibold text-muted-foreground">Artifacts</h2>
      <div className="flex-1 min-h-0 overflow-y-auto" />
    </section>
  )
}
