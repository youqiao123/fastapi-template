import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { SmilesDrawerViewer } from "@/components/ChemicalViewer/SmilesDrawerViewer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  parseSmilesFromCsv,
  type ParsedSmilesRow,
} from "@/lib/artifactPreview"
import { fetchArtifactText } from "@/lib/artifacts"
import { moleculeOptions } from "@/lib/smilesDrawerOptions"

type PreviewStatus = "idle" | "loading" | "ready" | "error"

type SmilesPreviewProps = {
  artifact: { id?: string; path: string }
  width?: number
  height?: number
}

export function SmilesPreview({
  artifact,
  width = moleculeOptions.width,
  height = moleculeOptions.height,
}: SmilesPreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedSmilesRow[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [pageInput, setPageInput] = useState<string>("1")

  useEffect(() => {
    setError(null)
    setRows([])
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
        const parsed = parseSmilesFromCsv(text)
        if (!parsed.length) {
          throw new Error("No SMILES rows found in the CSV file.")
        }
        setRows(parsed)
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

  useEffect(() => {
    if (!rows.length || status !== "ready") {
      setPageInput("")
      return
    }
    setPageInput(String(activeIndex + 1))
  }, [activeIndex, rows.length, status])

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < rows.length - 1
  const currentRow = rows[activeIndex] ?? null

  const commitPageInput = () => {
    if (!rows.length) return
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(activeIndex + 1))
      return
    }
    const clamped = Math.min(Math.max(parsed, 1), rows.length)
    setActiveIndex(clamped - 1)
    setPageInput(String(clamped))
  }

  const handlePageInputChange = (value: string) => {
    if (value === "") {
      setPageInput("")
      return
    }
    if (!/^\d+$/.test(value)) return
    setPageInput(value)
  }

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

      {status === "ready" && currentRow ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Showing row {activeIndex + 1} of {rows.length}
            </span>
            {typeof currentRow.nll === "number" ? (
              <span className="rounded bg-muted px-2 py-1 font-mono text-foreground">
                NLL: {currentRow.nll.toFixed(3)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                SMILES
              </span>
            <SmilesDrawerViewer
              smiles={currentRow.smiles}
              width={width}
              height={height}
              className="bg-background"
                showSmiles
              />
            </div>

            {currentRow.linker ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Linker
                </span>
                <SmilesDrawerViewer
                  smiles={currentRow.linker}
                  width={width}
                  height={Math.round(height * 0.5)}
                  className="bg-background"
                  showSmiles
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/15"
                onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                disabled={!hasPrev}
                aria-label="Previous molecule"
                title="Previous molecule"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-black dark:text-white">
                <Input
                  value={pageInput}
                  onChange={(event) => handlePageInputChange(event.target.value)}
                  onBlur={commitPageInput}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitPageInput()
                    }
                  }}
                  className="h-8 w-12 border-black px-2 text-center text-xs text-black dark:border-white dark:text-white"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Current SMILES index"
                />
                <span>of {rows.length}</span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/15"
                  onClick={() =>
                    setActiveIndex((index) =>
                    Math.min(rows.length - 1, index + 1),
                  )
                }
                disabled={!hasNext}
                aria-label="Next molecule"
                title="Next molecule"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
