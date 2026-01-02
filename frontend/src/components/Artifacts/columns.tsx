import type { ColumnDef } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Eye, Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { RdkitSmilesViewer } from "@/components/ChemicalViewer/RdkitSmilesViewer"
import { type ArtifactRecord } from "@/types/artifact"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import { cn } from "@/lib/utils"
import useCustomToast from "@/hooks/useCustomToast"
import {
  deleteArtifact,
  downloadArtifact,
  fetchArtifactText,
} from "@/lib/artifacts"

type PreviewStatus = "idle" | "loading" | "ready" | "error"

const isLinkerDesignCsv = (artifact: ArtifactRecord) =>
  artifact.type === "linker_design_output" &&
  artifact.path.toLowerCase().endsWith(".csv") &&
  !artifact.isFolder

const splitCsvLine = (rawLine: string): string[] => {
  const line = rawLine.replace(/\r$/, "")
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }

  cells.push(current)
  return cells
}

const normalizeCell = (cell: string) => cell.trim().replace(/^"|"$/g, "")

const parseSmilesFromCsv = (csvText: string): string[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  if (!lines.length) return []

  const headers = splitCsvLine(lines[0]).map((cell) =>
    normalizeCell(cell).toLowerCase(),
  )
  const smilesIndex = headers.findIndex((header) => header === "smiles")
  if (smilesIndex === -1) return []

  const smiles: string[] = []
  for (const rawLine of lines.slice(1)) {
    const cells = splitCsvLine(rawLine)
    const value = normalizeCell(cells[smilesIndex] ?? "")
    if (value) {
      smiles.push(value)
    }
  }

  return smiles
}

const formatDate = (value?: string) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export const artifactColumns: ColumnDef<ArtifactRecord>[] = [
  {
    accessorKey: "path",
    header: "Path",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{row.original.path}</span>
        <span className="text-[11px] text-muted-foreground break-all">
          {row.original.assetId}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.type}</span>
    ),
  },
  {
    accessorKey: "threadId",
    header: "Thread",
    cell: ({ row }) => (
      <span className="text-sm font-mono text-muted-foreground">
        {row.original.threadId}
      </span>
    ),
  },
  {
    accessorKey: "isFolder",
    header: "Kind",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          "text-xs",
          row.original.isFolder ? "border-primary text-primary" : "",
        )}
      >
        {row.original.isFolder ? "Folder" : "File"}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ArtifactActionsCell artifact={row.original} />,
    enableHiding: false,
  },
]

type ArtifactActionsCellProps = {
  artifact: ArtifactRecord
}

function ArtifactActionsCell({ artifact }: ArtifactActionsCellProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const isPreviewable = isLinkerDesignCsv(artifact)

  const deleteMutation = useMutation({
    mutationFn: () => deleteArtifact(artifact.id),
    onSuccess: () => {
      showSuccessToast("Artifact deleted.")
      setIsDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ["artifacts"] })
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to delete artifact"
      showErrorToast(message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["artifacts"] })
    },
  })

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadArtifact({ id: artifact.id, path: artifact.path })
      showSuccessToast("Download started.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to download artifact"
      showErrorToast(message)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = () => {
    setIsDeleteOpen(true)
  }

  const handlePreview = () => {
    if (!isPreviewable) {
      showErrorToast(
        "Preview is only available for linker_design_output CSV artifacts.",
      )
      return
    }
    setIsPreviewOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={
            isPreviewable
              ? "Preview"
              : "Preview available for linker_design_output CSV files"
          }
          onClick={handlePreview}
        >
          <Eye className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Download"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          <Download className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Delete"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete artifact</DialogTitle>
            <DialogDescription>
              This artifact will be permanently deleted. You will not be able to
              undo this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={deleteMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ArtifactPreviewDialog
        artifact={artifact}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </>
  )
}

type ArtifactPreviewDialogProps = {
  artifact: ArtifactRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ArtifactPreviewDialog({
  artifact,
  open,
  onOpenChange,
}: ArtifactPreviewDialogProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [smilesList, setSmilesList] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) return

    if (!isLinkerDesignCsv(artifact)) {
      setStatus("error")
      setError(
        "Preview is only available for linker_design_output CSV artifacts.",
      )
      return
    }

    const controller = new AbortController()

    setStatus("loading")
    setError(null)
    setSmilesList([])
    setActiveIndex(0)

    fetchArtifactText(artifact, { signal: controller.signal })
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
  }, [artifact.id, artifact.path, artifact.type, artifact.isFolder, open])

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < smilesList.length - 1
  const currentSmiles = smilesList[activeIndex] ?? ""

  const handlePrev = () => setActiveIndex((index) => Math.max(0, index - 1))
  const handleNext = () =>
    setActiveIndex((index) => Math.min(smilesList.length - 1, index + 1))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Preview artifact</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {artifact.type}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground break-all">
              {artifact.path}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading SMILES from CSV...</span>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="text-sm text-destructive">
              {error ?? "Unable to load preview."}
            </div>
          ) : null}

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
                width={520}
                height={360}
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
                    onClick={handlePrev}
                    disabled={!hasPrev}
                  >
                    Previous
                  </Button>
                  <Button size="sm" onClick={handleNext} disabled={!hasNext}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
