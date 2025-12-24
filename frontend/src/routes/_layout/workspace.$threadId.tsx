import { createFileRoute } from "@tanstack/react-router"

import { WorkspacePage } from "@/components/Workspace/WorkspacePage"

export const Route = createFileRoute("/_layout/workspace/$threadId")({
  component: WorkspaceThreadRoute,
  head: () => ({
    meta: [
      {
        title: "Workspace - TPDagent Cloud",
      },
    ],
  }),
})

function WorkspaceThreadRoute() {
  const { threadId } = Route.useParams()
  return <WorkspacePage threadId={threadId} />
}
