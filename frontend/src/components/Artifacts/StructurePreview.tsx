import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { MolstarViewer } from "@/components/ProteinViewer/MolstarViewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getComplexModelFiles,
  getDefaultComplexModelIndex,
  getStructureFormat,
} from "@/lib/artifactPreview"
import { fetchArtifactText, listArtifactFiles } from "@/lib/artifacts"
import { type ArtifactDisplay } from "@/types/artifact"

type PreviewStatus = "idle" | "loading" | "ready" | "error"
type ConfidenceStatus = "idle" | "loading" | "ready" | "missing" | "error"

type ConfidenceScores = {
  confidence_score?: number
  ptm?: number
  iptm?: number
  ligand_iptm?: number
  protein_iptm?: number
  complex_plddt?: number
  complex_iplddt?: number
  complex_pde?: number
  complex_ipde?: number
  chains_ptm?: Record<string, number>
  pair_chains_iptm?: Record<string, Record<string, number>>
}

type ScalarConfidenceKey =
  | "confidence_score"
  | "ptm"
  | "iptm"
  | "ligand_iptm"
  | "protein_iptm"
  | "complex_plddt"
  | "complex_iplddt"
  | "complex_pde"
  | "complex_ipde"

const toConfidenceFile = (structureFile: string): string | null => {
  const match = structureFile.match(/^complex_model_(\d+)\.cif$/i)
  if (!match) return null
  return `confidence_complex_model_${match[1]}.json`
}

const chainLabel = (chainId: string) => {
  if (chainId === "0") return "POI"
  if (chainId === "1") return "E3"
  if (chainId === "2") return "PROTAC"
  return `Chain ${chainId}`
}

const metricFields: { key: ScalarConfidenceKey; label: string }[] = [
  { key: "confidence_score", label: "Confidence" },
  { key: "ptm", label: "pTM" },
  { key: "iptm", label: "ipTM" },
  { key: "ligand_iptm", label: "Ligand ipTM" },
  { key: "protein_iptm", label: "Protein ipTM" },
  { key: "complex_plddt", label: "Complex pLDDT" },
  { key: "complex_iplddt", label: "Complex ipLDDT" },
  { key: "complex_pde", label: "Complex PDE" },
  { key: "complex_ipde", label: "Complex ipPDE" },
]

const formatScore = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(3)
    : "—"

type StructurePreviewProps = {
  artifact: ArtifactDisplay
  height?: number
}

export function StructurePreview({
  artifact,
  height = 420,
}: StructurePreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [structureFiles, setStructureFiles] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [pageInput, setPageInput] = useState<string>("1")
  const [structureCache, setStructureCache] = useState<
    Record<string, { data: string; format: "pdb" | "cif" }>
  >({})
  const [structureData, setStructureData] = useState<{
    data: string
    format: "pdb" | "cif"
  } | null>(null)
  const [confidenceCache, setConfidenceCache] = useState<
    Record<string, ConfidenceScores | null>
  >({})
  const [confidenceData, setConfidenceData] = useState<ConfidenceScores | null>(
    null,
  )
  const [confidenceStatus, setConfidenceStatus] =
    useState<ConfidenceStatus>("idle")

  useEffect(() => {
    setError(null)
    setStructureData(null)
    setStructureFiles([])
    setActiveIndex(0)
    setStructureCache({})
    setConfidenceCache({})
    setConfidenceData(null)
    setConfidenceStatus("idle")

    if (!artifact.id) {
      setStatus("error")
      setError("Preview will be available once the artifact is saved.")
      return
    }

    const controller = new AbortController()
    setStatus("loading")

    if (!artifact.isFolder) {
      fetchArtifactText(
        { id: artifact.id, path: artifact.path },
        { signal: controller.signal },
      )
        .then((text) => {
          if (!text.trim()) {
            throw new Error("Structure file is empty.")
          }
          setStructureData({
            data: text,
            format: getStructureFormat(artifact.path),
          })
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
    }

    listArtifactFiles(artifact.id, {
      prefix: "complex_model_",
      suffix: ".cif",
      signal: controller.signal,
    })
      .then((files) => {
        const complexFiles = getComplexModelFiles(files)
        if (!complexFiles.length) {
          throw new Error(
            "No complex_model_*.cif files found in the artifact folder.",
          )
        }

        setStructureFiles(complexFiles)
        setActiveIndex(getDefaultComplexModelIndex(complexFiles))
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load artifact files",
        )
        setStatus("error")
      })

    return () => controller.abort()
  }, [artifact.id, artifact.isFolder, artifact.path])

  useEffect(() => {
    if (!artifact.isFolder || !artifact.id || !structureFiles.length) {
      setConfidenceStatus(artifact.isFolder ? "missing" : "idle")
      setConfidenceData(null)
      return
    }

    const controller = new AbortController()
    const targetFile = structureFiles[activeIndex] ?? structureFiles[0]

    if (!targetFile) {
      controller.abort()
      return () => controller.abort()
    }

    const cached = structureCache[targetFile]
    if (cached) {
      setStructureData(cached)
      setStatus("ready")
    } else {
      setStatus("loading")
      setError(null)

      fetchArtifactText(
        { id: artifact.id, path: artifact.path },
        { signal: controller.signal, filePath: targetFile },
      )
        .then((text) => {
          if (!text.trim()) {
            throw new Error("Structure file is empty.")
          }
          const data = {
            data: text,
            format: getStructureFormat(targetFile, "cif"),
          } as const
          setStructureCache((prev) => ({ ...prev, [targetFile]: data }))
          setStructureData(data)
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
    }

    const confidenceFile = toConfidenceFile(targetFile)
    if (!confidenceFile) {
      setConfidenceStatus("missing")
      setConfidenceData(null)
      return () => controller.abort()
    }

    const cachedConfidence = confidenceCache[confidenceFile]
    if (cachedConfidence !== undefined) {
      setConfidenceData(cachedConfidence)
      setConfidenceStatus(cachedConfidence ? "ready" : "missing")
      return () => controller.abort()
    }

    setConfidenceStatus("loading")
    setConfidenceData(null)

    fetchArtifactText(
      { id: artifact.id, path: artifact.path },
      { signal: controller.signal, filePath: confidenceFile },
    )
      .then((text) => {
        const parsed = JSON.parse(text) as ConfidenceScores
        setConfidenceCache((prev) => ({ ...prev, [confidenceFile]: parsed }))
        setConfidenceData(parsed)
        setConfidenceStatus("ready")
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error("Failed to load confidence scores", err)
        setConfidenceCache((prev) => ({ ...prev, [confidenceFile]: null }))
        setConfidenceData(null)
        setConfidenceStatus(
          err instanceof Error && /not found/i.test(err.message)
            ? "missing"
            : "error",
        )
      })

    return () => controller.abort()
  }, [
    activeIndex,
    artifact.id,
    artifact.isFolder,
    artifact.path,
    structureCache,
    structureFiles,
  ])

  useEffect(() => {
    if (!artifact.isFolder || !structureFiles.length) {
      setPageInput("")
      return
    }
    setPageInput(String(activeIndex + 1))
  }, [activeIndex, artifact.isFolder, structureFiles.length])

  const isLoading = status === "loading"
  const isFolder = artifact.isFolder
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < structureFiles.length - 1
  const currentStructureFile = structureFiles[activeIndex] ?? structureFiles[0]

  const commitPageInput = () => {
    if (!isFolder || !structureFiles.length) return
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(activeIndex + 1))
      return
    }
    const clamped = Math.min(Math.max(parsed, 1), structureFiles.length)
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
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading structure file...</span>
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

      {status === "ready" && structureData ? (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex flex-col">
              <span>3D structure preview</span>
              {isFolder && currentStructureFile ? (
                <span className="font-mono text-[11px] text-foreground break-all">
                  {currentStructureFile}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">
                {structureData.format.toUpperCase()}
              </Badge>
            </div>
          </div>

          <MolstarViewer
            data={structureData.data}
            format={structureData.format}
            height={height}
            className="bg-background mx-auto"
          />

          {isFolder && structureFiles.length > 1 ? (
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/15"
                  onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                  disabled={!hasPrev || isLoading}
                  aria-label="Previous model"
                  title="Previous model"
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
                    aria-label="Current model index"
                    disabled={isLoading}
                  />
                  <span>of {structureFiles.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-black hover:bg-black/10 dark:text-white dark:hover:bg-white/15"
                  onClick={() =>
                    setActiveIndex((index) =>
                      Math.min(structureFiles.length - 1, index + 1),
                    )
                  }
                  disabled={!hasNext || isLoading}
                  aria-label="Next model"
                  title="Next model"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {isFolder ? (
            <div className="mt-3 w-full max-h-[55vh] overflow-y-auto rounded-md border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Confidence scores
                </p>
                {currentStructureFile ? (
                  <Badge variant="outline" className="text-[11px]">
                    {toConfidenceFile(currentStructureFile) ?? "N/A"}
                  </Badge>
                ) : null}
              </div>

              {confidenceStatus === "loading" ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading confidence…</span>
                </div>
              ) : null}

              {confidenceStatus === "ready" && confidenceData ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {metricFields.map(({ key, label }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-2 py-1"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono text-foreground">
                          {formatScore(confidenceData[key])}
                        </span>
                      </div>
                    ))}
                  </div>

                  {confidenceData.chains_ptm ? (
                    <div className="rounded border border-border/40 bg-background/40 p-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Chain pTM
                      </p>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                        {Object.entries(confidenceData.chains_ptm).map(
                          ([chain, score]) => (
                            <div
                              key={chain}
                              className="flex items-center justify-between"
                            >
                              <span className="text-muted-foreground">
                                {chainLabel(chain)}
                              </span>
                              <span className="font-mono text-foreground">
                                {formatScore(score)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {confidenceData.pair_chains_iptm ? (
                    <div className="rounded border border-border/40 bg-background/40 p-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Pair ipTM
                      </p>
                      {(() => {
                        const entries = Object.entries(
                          confidenceData.pair_chains_iptm ?? {},
                        )
                        const colKeys = Array.from(
                          new Set(
                            entries.flatMap(([, partners]) =>
                              Object.keys(partners ?? {}),
                            ),
                          ),
                        ).sort()

                        if (!entries.length || !colKeys.length) {
                          return (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              No pair scores available.
                            </p>
                          )
                        }

                        const gridCols = `72px repeat(${colKeys.length}, minmax(0, 1fr))`

                        return (
                          <div className="mt-2 overflow-x-auto">
                            <div className="min-w-full space-y-1 text-[11px]">
                              <div
                                className="grid items-center border-b border-border/60 text-muted-foreground"
                                style={{ gridTemplateColumns: gridCols }}
                              >
                                <div className="px-2 py-1 text-left">Chain</div>
                                {colKeys.map((col) => (
                                  <div
                                    key={col}
                                    className="px-2 py-1 text-right"
                                  >
                                    {chainLabel(col)}
                                  </div>
                                ))}
                              </div>

                              {entries.map(([rowKey, partners], rowIndex) => (
                                <div
                                  key={rowKey}
                                  className="grid items-center border-b border-border/40"
                                  style={{ gridTemplateColumns: gridCols }}
                                >
                                  <div className="px-2 py-1 text-left font-medium text-foreground">
                                    {chainLabel(rowKey)}
                                  </div>
                                  {colKeys.map((col) => (
                                    <div
                                      key={col}
                                      className={cn(
                                        "px-2 py-1 text-right font-mono",
                                        rowIndex % 2 === 1 ? "bg-muted/20" : "",
                                      )}
                                    >
                                      {formatScore(
                                        partners?.[col] as number | undefined,
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {confidenceStatus === "missing" ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  No confidence JSON found for this model.
                </p>
              ) : null}

              {confidenceStatus === "error" ? (
                <p className="mt-2 text-[11px] text-destructive">
                  Failed to load confidence scores.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
