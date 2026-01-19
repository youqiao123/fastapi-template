import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

import { MolstarViewer } from "@/components/ProteinViewer/MolstarViewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getComplexModelFiles,
  getDefaultComplexModelIndex,
  getStructureFormat,
} from "@/lib/artifactPreview"
import { fetchArtifactText, listArtifactFiles } from "@/lib/artifacts"
import { type ArtifactDisplay } from "@/types/artifact"

type PreviewStatus = "idle" | "loading" | "ready" | "error"

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

  useEffect(() => {
    setError(null)
    setStructureData(null)
    setStructureFiles([])
    setActiveIndex(0)
    setStructureCache({})

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
      return () => controller.abort()
    }

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
            className="bg-background"
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

          <span className="text-xs text-muted-foreground">
            {isFolder
              ? "Use the controls to switch between complex_model_*.cif files in this folder."
              : "Use the Mol* controls to inspect the ternary complex structure."}
          </span>
        </>
      ) : null}
    </div>
  )
}
