import { cn } from "@/lib/utils"
import { type ArtifactDisplay } from "@/types/artifact"

type ArtifactPanelProps = {
  artifacts?: ArtifactDisplay[]
  className?: string
}

export function ArtifactPanel({
  artifacts = [],
  className,
}: ArtifactPanelProps) {
  const hasArtifacts = artifacts.length > 0

  return (
    <section className={cn("flex min-h-0 flex-col gap-2", className)}>
      <h2 className="text-sm font-semibold text-muted-foreground">Artifacts</h2>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {hasArtifacts ? (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60 bg-background/50">
            {artifacts.map((artifact) => (
              <li
                key={artifact.id ?? `${artifact.assetId}-${artifact.path}`}
                className="p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {artifact.path}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {artifact.type}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      ID: {artifact.assetId}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {artifact.isFolder ? "Folder" : "File"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No artifacts yet. They will appear here after the run finishes.
          </p>
        )}
      </div>
    </section>
  )
}
