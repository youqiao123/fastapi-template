import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/workspace")({
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  return <Outlet />
}
