import type { ColumnDef } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Eye, Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { RdkitSmilesViewer } from "@/components/ChemicalViewer/RdkitSmilesViewer"
import { MolstarViewer } from "@/components/ProteinViewer/MolstarViewer"
import { type ArtifactRecord } from "@/types/artifact"
import {
  getPreviewMode,
  getStructureFormat,
  parseSmilesFromCsv,
  type PreviewMode,
} from "@/lib/artifactPreview"
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

  const previewMode = getPreviewMode(artifact)
  const isPreviewable = previewMode !== "unsupported"

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
        "Preview is available for linker_design_output CSV and ternary_complex_structure PDB/CIF artifacts.",
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
              : "Preview available for linker_design_output CSV or ternary_complex_structure PDB/CIF files"
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
        previewMode={previewMode}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </>
  )
}

type ArtifactPreviewDialogProps = {
  artifact: ArtifactRecord
  previewMode: PreviewMode
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ArtifactPreviewDialog({
  artifact,
  previewMode,
  open,
  onOpenChange,
}: ArtifactPreviewDialogProps) {
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [smilesList, setSmilesList] = useState<string[]>([])
  const [structureData, setStructureData] = useState<{
    data: string
    format: "pdb" | "cif"
  } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const loadingLabel =
    previewMode === "structure"
      ? "Loading structure file..."
      : "Loading SMILES from CSV..."

  useEffect(() => {
    if (!open) return

    const mode = previewMode

    if (mode === "unsupported") {
      setStatus("error")
      setError(
        "Preview is available for linker_design_output CSV and ternary_complex_structure PDB/CIF artifacts.",
      )
      return
    }

    const controller = new AbortController()

    setStatus("loading")
    setError(null)
    setSmilesList([])
    setStructureData(null)
    setActiveIndex(0)

    fetchArtifactText(artifact, { signal: controller.signal })
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
  }, [
    artifact.id,
    artifact.path,
    artifact.type,
    artifact.isFolder,
    open,
    previewMode,
  ])

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
              <span>{loadingLabel}</span>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="text-sm text-destructive">
              {error ?? "Unable to load preview."}
            </div>
          ) : null}

          {status === "ready" && previewMode === "smiles" ? (
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

          {status === "ready" &&
          previewMode === "structure" &&
          structureData ? (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>3D structure preview</span>
                <Badge variant="secondary" className="text-xs">
                  {structureData.format.toUpperCase()}
                </Badge>
              </div>

              <MolstarViewer
                data={structureData.data}
                format={structureData.format}
                height={520}
                className="bg-background"
              />

              <span className="text-xs text-muted-foreground">
                Use the Mol* controls to inspect the ternary complex structure.
              </span>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
