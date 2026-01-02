import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { artifactColumns } from "@/components/Artifacts/columns"
import { DataTable } from "@/components/Common/DataTable"
import PendingArtifacts from "@/components/Pending/PendingArtifacts"
import { listArtifacts } from "@/lib/artifacts"

function getArtifactsQueryOptions() {
  return {
    queryFn: () => listArtifacts({ limit: 200 }),
    queryKey: ["artifacts"],
  }
}

export const Route = createFileRoute("/_layout/artifact")({
  component: Artifacts,
  head: () => ({
    meta: [
      {
        title: "Artifact",
      },
    ],
  }),
})

function ArtifactsTableContent() {
  const { data: artifacts } = useSuspenseQuery(getArtifactsQueryOptions())

  if (!artifacts.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No artifacts yet</h3>
        <p className="text-muted-foreground">
          Run an agent and check back here.
        </p>
      </div>
    )
  }

  return <DataTable columns={artifactColumns} data={artifacts} />
}

function ArtifactsTable() {
  return (
    <Suspense fallback={<PendingArtifacts />}>
      <ArtifactsTableContent />
    </Suspense>
  )
}

function Artifacts() {
  return (
    <div className="flex flex-col gap-6">
      <ArtifactsTable />
    </div>
  )
}
