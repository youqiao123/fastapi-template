import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router"

import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const locationPathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const pageTitle = useRouterState({
    select: (state) => {
      const matches = [...state.matches].reverse()

      for (const match of matches) {
        const meta = match.meta
        if (!Array.isArray(meta)) {
          continue
        }

        const titleEntry = meta.find(
          (entry) =>
            Boolean(entry) &&
            typeof entry === "object" &&
            "title" in entry,
        ) as { title?: string } | undefined

        const title = titleEntry?.title
        if (typeof title === "string" && title.length > 0) {
          return title.split(" - ")[0]
        }
      }

      return ""
    },
  })
  const isWorkspaceRoute = locationPathname.startsWith("/workspace")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground truncate">
            {pageTitle}
          </h1>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div
            className={
              isWorkspaceRoute ? "h-full w-full max-w-none" : "mx-auto max-w-7xl"
            }
          >
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
