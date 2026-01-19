import type { ColumnDef } from "@tanstack/react-table"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Eye, Trash2 } from "lucide-react"
import { useState } from "react"

import { SmilesPreview } from "@/components/Artifacts/SmilesPreview"
import { StructurePreview } from "@/components/Artifacts/StructurePreview"
import { SequencePreview } from "@/components/Artifacts/SequencePreview"
import { type ArtifactRecord } from "@/types/artifact"
import { getPreviewMode, type PreviewMode } from "@/lib/artifactPreview"
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
} from "@/lib/artifacts"
import { moleculeOptions } from "@/lib/smilesDrawerOptions"

const formatDate = (value?: string) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const PREVIEW_SUPPORT_MESSAGE =
  "Preview is available for linker_design_output CSV, ternary_complex_structure PDB/CIF artifacts or folders, and sequence FASTA files."
const SMILES_PREVIEW_SCALE = 0.8
const SMILES_PREVIEW_WIDTH = Math.round(
  moleculeOptions.width * SMILES_PREVIEW_SCALE,
)
const SMILES_PREVIEW_HEIGHT = Math.round(
  moleculeOptions.height * SMILES_PREVIEW_SCALE,
)

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
      showErrorToast(PREVIEW_SUPPORT_MESSAGE)
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
              : "Preview available for linker_design_output CSV, ternary_complex_structure PDB/CIF files and folders, and sequence FASTA files"
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
  const isUnsupported = previewMode === "unsupported"
  const errorMessage = PREVIEW_SUPPORT_MESSAGE

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
          {isUnsupported ? (
            <div className="text-sm text-destructive">{errorMessage}</div>
          ) : null}

          {open && previewMode === "smiles" ? (
            <SmilesPreview
              key={artifact.id ?? artifact.path}
              artifact={artifact}
              width={SMILES_PREVIEW_WIDTH}
              height={SMILES_PREVIEW_HEIGHT}
            />
          ) : null}

          {open && previewMode === "structure" ? (
            <StructurePreview
              key={artifact.id ?? artifact.path}
              artifact={artifact}
              height={520}
            />
          ) : null}

          {open && previewMode === "sequence" ? (
            <SequencePreview
              key={artifact.id ?? artifact.path}
              artifact={artifact}
              groupSize={10}
              groupsPerRow={12}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
