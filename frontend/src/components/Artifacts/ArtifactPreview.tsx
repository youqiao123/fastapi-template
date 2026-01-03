import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { RdkitSmilesViewer } from "@/components/ChemicalViewer/RdkitSmilesViewer"
import { MolstarViewer } from "@/components/ProteinViewer/MolstarViewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getPreviewMode,
  getStructureFormat,
  parseSmilesFromCsv,
} from "@/lib/artifactPreview"
import { fetchArtifactText } from "@/lib/artifacts"
import { type ArtifactDisplay } from "@/types/artifact"
import { cn } from "@/lib/utils"

type PreviewStatus = "idle" | "loading" | "ready" | "error"

type ArtifactPreviewProps = {
  artifact: ArtifactDisplay
  className?: string
}

export function ArtifactPreview({ artifact, className }: ArtifactPreviewProps) {
  const previewMode = useMemo(
    () => getPreviewMode(artifact),
    [artifact.isFolder, artifact.path, artifact.type],
  )
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [smilesList, setSmilesList] = useState<string[]>([])
  const [structureData, setStructureData] = useState<{
    data: string
    format: "pdb" | "cif"
  } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setError(null)
    setSmilesList([])
    setStructureData(null)
    setActiveIndex(0)

    const mode = previewMode

    if (mode === "unsupported") {
      setStatus("error")
      setError(
        "Preview is available for linker_design_output CSV and ternary_complex_structure PDB/CIF artifacts.",
      )
      return
    }

    if (!artifact.id) {
      setStatus("error")
      setError("Preview will be available once the artifact is saved.")
      return
    }

    const controller = new AbortController()
    setStatus("loading")

    fetchArtifactText(
      { id: artifact.id, path: artifact.path },
      { signal: controller.signal },
    )
      .then((text) => {
        if (mode === "smiles") {
          const smiles = parseSmilesFromCsv(text)
          if (!smiles.length) {
            throw new Error("No SMILES values found in the CSV file.")
          }
          setSmilesList(smiles)
          setActiveIndex(0)
        } else if (mode === "structure") {
          if (!text.trim()) {
            throw new Error("Structure file is empty.")
          }
          setStructureData({
            data: text,
            format: getStructureFormat(artifact.path),
          })
        }
        setStatus("ready")
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load artifact preview",
        )
        setStatus("error")
      })

    return () => controller.abort()
  }, [artifact.id, artifact.path, artifact.type, artifact.isFolder, previewMode])

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < smilesList.length - 1
  const currentSmiles = smilesList[activeIndex] ?? ""

  const renderStatus = () => {
    if (status === "loading") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading preview...</span>
        </div>
      )
    }

    if (status === "error") {
      return (
        <div className="rounded-md border border-destructive/60 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error ?? "Unable to load preview."}
        </div>
      )
    }

    return null
  }

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

      {renderStatus()}

      {status === "ready" && previewMode === "smiles" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing SMILES {activeIndex + 1} of {smilesList.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                disabled={!hasPrev}
              >
                Previous
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setActiveIndex((index) =>
                    Math.min(smilesList.length - 1, index + 1),
                  )
                }
                disabled={!hasNext}
              >
                Next
              </Button>
            </div>
          </div>

          <RdkitSmilesViewer
            smiles={currentSmiles}
            width={420}
            height={320}
            className="bg-background"
            showSmiles
          />
        </div>
      ) : null}

      {status === "ready" &&
      previewMode === "structure" &&
      structureData ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>3D structure preview</span>
            <Badge variant="secondary" className="text-[11px]">
              {structureData.format.toUpperCase()}
            </Badge>
          </div>

          <MolstarViewer
            data={structureData.data}
            format={structureData.format}
            height={420}
            className="bg-background"
          />
        </div>
      ) : null}
    </div>
  )
}
