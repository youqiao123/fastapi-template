import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { RdkitSmilesViewer } from "@/components/ChemicalViewer/RdkitSmilesViewer"
import { Button } from "@/components/ui/button"
import { parseSmilesFromCsv } from "@/lib/artifactPreview"
import { fetchArtifactText } from "@/lib/artifacts"

type PreviewStatus = "idle" | "loading" | "ready" | "error"

type SmilesPreviewProps = {
  artifact: { id?: string; path: string }
  width?: number
  height?: number
}

export function SmilesPreview({
  artifact,
  width = 420,
  height = 320,
}: SmilesPreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [smilesList, setSmilesList] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setError(null)
    setSmilesList([])
    setActiveIndex(0)

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
        const smiles = parseSmilesFromCsv(text)
        if (!smiles.length) {
          throw new Error("No SMILES values found in the CSV file.")
        }
        setSmilesList(smiles)
        setActiveIndex(0)
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
  }, [artifact.id, artifact.path])

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < smilesList.length - 1
  const currentSmiles = smilesList[activeIndex] ?? ""

  const renderStatus = () => {
    if (status === "loading") {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading SMILES from CSV...</span>
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
    <div className="space-y-3">
      {renderStatus()}

      {status === "ready" ? (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing SMILES {activeIndex + 1} of {smilesList.length}
            </span>
            <span className="text-xs font-mono rounded bg-muted px-2 py-1">
              SMILES column
            </span>
          </div>

          <RdkitSmilesViewer
            smiles={currentSmiles}
            width={width}
            height={height}
            className="bg-background"
            showSmiles
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Use the controls to browse SMILES from the CSV file.
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
        </>
      ) : null}
    </div>
  )
}
