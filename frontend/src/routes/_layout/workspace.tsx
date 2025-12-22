import { createFileRoute } from "@tanstack/react-router"

import { WorkspacePage } from "@/components/Workspace/WorkspacePage"

export const Route = createFileRoute("/_layout/workspace")({
  component: WorkspacePage,
  head: () => ({
    meta: [
      {
        title: "Workspace - FastAPI Cloud",
      },
    ],
  }),
})
