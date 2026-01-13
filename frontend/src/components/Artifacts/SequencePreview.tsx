import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  parseSequencesFromText,
  type ParsedSequence,
} from "@/lib/artifactPreview"
import { fetchArtifactText } from "@/lib/artifacts"
import "./SequencePreview.css"

type PreviewStatus = "idle" | "loading" | "ready" | "error"

type SequencePreviewProps = {
  artifact: { id?: string; path: string }
  groupSize?: number
}

const DEFAULT_GROUP_SIZE = 10

export function SequencePreview({
  artifact,
  groupSize = DEFAULT_GROUP_SIZE,
}: SequencePreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [sequences, setSequences] = useState<ParsedSequence[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [blockWidth, setBlockWidth] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    setError(null)
    setSequences([])
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
        const parsed = parseSequencesFromText(text)
        if (!parsed.length) {
          throw new Error("No sequences found in the file.")
        }
        setSequences(parsed)
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
  const hasNext = activeIndex < sequences.length - 1
  const currentSequence = sequences[activeIndex] ?? sequences[0]

  const chunkedGroups = useMemo(() => {
    if (!currentSequence) return []
    const groups: { value: string; end: number }[] = []
    const content = currentSequence.sequence

    for (let start = 0; start < content.length; start += groupSize) {
      const slice = content.slice(start, start + groupSize)
      groups.push({
        value: slice,
        end: start + slice.length,
      })
    }

    return groups
  }, [currentSequence, groupSize])

  useEffect(() => {
    const container = containerRef.current
    const measurer = measureRef.current
    if (!container || !measurer || typeof ResizeObserver === "undefined") {
      return
    }

    const updateWidth = () => {
      const measuredWidth = measurer.getBoundingClientRect().width
      if (!measuredWidth) return

      setBlockWidth(measuredWidth)
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [groupSize, status])

  const blockWidthValue =
    blockWidth !== null ? `${blockWidth}px` : `${groupSize + 2}ch`
  const renderStatus = () => {
    if (status === "loading") {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading sequence file...</span>
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

  const showSequenceHeader = Boolean(
    currentSequence?.id || currentSequence?.description,
  )

  return (
    <div className="relative space-y-3">
      {renderStatus()}

      {status === "ready" && currentSequence ? (
        <>
          <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
            <div className="min-w-0 space-y-1">
              <span className="text-sm font-semibold text-foreground">
                Sequence preview
              </span>
              <p className="font-mono text-[11px] text-muted-foreground break-all">
                {artifact.path}
              </p>
              {showSequenceHeader ? (
                <p className="text-[11px] text-muted-foreground break-all">
                  {currentSequence?.id ?? "Sequence"}
                  {currentSequence?.description
                    ? ` · ${currentSequence.description}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {sequences.length > 1 ? (
                <Badge variant="outline" className="text-[11px]">
                  Sequence {activeIndex + 1} of {sequences.length}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="text-[11px]">
                {currentSequence.sequence.length} aa
              </Badge>
            </div>
          </div>

          {sequences.length > 1 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono text-[11px] text-muted-foreground break-all">
                {currentSequence.id}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                  disabled={!hasPrev || status === "loading"}
                >
                  Previous sequence
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setActiveIndex((index) =>
                      Math.min(sequences.length - 1, index + 1),
                    )
                  }
                  disabled={!hasNext || status === "loading"}
                >
                  Next sequence
                </Button>
              </div>
            </div>
          ) : null}

          <div
            ref={containerRef}
            className="sequence-wrapper"
            style={{ ["--block-width" as string]: blockWidthValue }}
          >
            <div className="sequence-blocks">
              {chunkedGroups.map((group, index) => (
                <div key={`${group.value}-${group.end}-${index}`} className="sequence-block">
                  <div className="sequence-number">{group.end}</div>
                  <div className="sequence-line">{group.value}</div>
                </div>
              ))}
            </div>
          </div>

          <span
            ref={measureRef}
            aria-hidden
            className="sequence-measure sequence-cell"
          >
            {"A".repeat(groupSize)}
          </span>
        </>
      ) : null}
    </div>
  )
}
