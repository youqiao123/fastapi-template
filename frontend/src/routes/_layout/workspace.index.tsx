import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceIndexPage } from "@/components/Workspace/WorkspaceIndexPage"

export const Route = createFileRoute("/_layout/workspace/")({
  component: WorkspaceIndexRoute,
  head: () => ({
    meta: [
      {
        title: "Workspace - TPDagent Cloud",
      },
    ],
  }),
})

function WorkspaceIndexRoute() {
  return <WorkspaceIndexPage />
}
