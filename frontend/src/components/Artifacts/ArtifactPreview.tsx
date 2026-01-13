import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { SmilesPreview } from "@/components/Artifacts/SmilesPreview"
import { StructurePreview } from "@/components/Artifacts/StructurePreview"
import { SequencePreview } from "@/components/Artifacts/SequencePreview"
import { getPreviewMode } from "@/lib/artifactPreview"
import { type ArtifactDisplay } from "@/types/artifact"
import { cn } from "@/lib/utils"

type ArtifactPreviewProps = {
  artifact: ArtifactDisplay
  className?: string
}

export function ArtifactPreview({ artifact, className }: ArtifactPreviewProps) {
  const previewMode = useMemo(
    () => getPreviewMode(artifact),
    [artifact.isFolder, artifact.path, artifact.type],
  )

  const renderUnsupported = () => (
    <div className="rounded-md border border-destructive/60 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      Preview is available for linker_design_output CSV, ternary_complex_structure
      PDB/CIF artifacts or folders, and sequence FASTA files.
    </div>
  )

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-3 rounded-md border border-border/60 bg-background/50 p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Artifact preview
          </p>
          <p className="text-xs text-muted-foreground break-all">
            {artifact.path}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {artifact.type}
        </Badge>
      </div>

      {previewMode === "smiles" ? (
        <SmilesPreview
          key={artifact.id ?? artifact.path}
          artifact={artifact}
          width={420}
          height={320}
        />
      ) : null}

      {previewMode === "structure" ? (
        <StructurePreview
          key={artifact.id ?? artifact.path}
          artifact={artifact}
          height={420}
        />
      ) : null}

      {previewMode === "sequence" ? (
        <SequencePreview
          key={artifact.id ?? artifact.path}
          artifact={artifact}
          groupSize={10}
          groupsPerRow={12}
        />
      ) : null}

      {previewMode === "unsupported" ? renderUnsupported() : null}
    </div>
  )
}
