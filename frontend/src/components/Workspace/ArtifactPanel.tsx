import { type ArtifactDisplay } from "@/types/artifact"
import { ArtifactPreview } from "@/components/Artifacts/ArtifactPreview"
import { cn } from "@/lib/utils"

type ArtifactPanelProps = {
  artifacts?: ArtifactDisplay[]
  className?: string
  activeArtifact?: ArtifactDisplay | null
  onArtifactSelect?: (artifact: ArtifactDisplay) => void
}

export function ArtifactPanel({
  artifacts = [],
  className,
  activeArtifact,
  onArtifactSelect,
}: ArtifactPanelProps) {
  const getArtifactKey = (artifact: ArtifactDisplay) =>
    `${artifact.assetId}-${artifact.path}`
  const hasArtifacts = artifacts.length > 0
  const selectedArtifact =
    activeArtifact && hasArtifacts
      ? artifacts.find(
          (artifact) => getArtifactKey(artifact) === getArtifactKey(activeArtifact),
        ) ?? artifacts[0]
      : hasArtifacts
        ? artifacts[0]
        : null

  return (
    <section className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {hasArtifacts ? (
          <>
            <ul className="max-h-52 overflow-y-auto divide-y divide-border/60 rounded-md border border-border/60 bg-background/50">
              {artifacts.map((artifact) => {
                const isActive =
                  selectedArtifact &&
                  getArtifactKey(artifact) === getArtifactKey(selectedArtifact)
                return (
                  <li key={artifact.id ?? getArtifactKey(artifact)}>
                    <button
                      type="button"
                      onClick={() => onArtifactSelect?.(artifact)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 p-3 text-left transition-colors",
                        isActive
                          ? "bg-muted/60"
                          : "hover:bg-muted/40 focus-visible:bg-muted/40",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {artifact.path}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {artifact.type}
                        </p>
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        {artifact.isFolder ? "Folder" : "File"}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {selectedArtifact ? (
              <ArtifactPreview
                artifact={selectedArtifact}
                className="min-h-[320px]"
              />
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No artifacts yet. They will appear here after the run finishes.
          </p>
        )}
      </div>
    </section>
  )
}
