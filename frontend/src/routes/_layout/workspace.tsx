import { createFileRoute } from "@tanstack/react-router"

import { WorkspacePage } from "@/components/Workspace/WorkspacePage"

export const Route = createFileRoute("/_layout/workspace")({
  component: WorkspaceRoute,
  head: () => ({
    meta: [
      {
        title: "Workspace - TPDagent Cloud",
      },
    ],
  }),
})

function WorkspaceRoute() {
  return <WorkspacePage />
}
