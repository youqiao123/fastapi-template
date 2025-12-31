import type { ColumnDef } from "@tanstack/react-table"

import { type ArtifactRecord } from "@/types/artifact"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
]
