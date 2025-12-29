import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Briefcase,
  Home,
  LayoutGrid,
  Plus,
  Users,
} from "lucide-react"
import { useState } from "react"

import { CreateThreadDialog } from "@/components/Common/CreateThreadDialog"
import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import useCustomToast from "@/hooks/useCustomToast"
import useAuth from "@/hooks/useAuth"
import {
  createThread,
  getThreadTitle,
  listThreads,
  THREADS_QUERY_KEY,
} from "@/lib/threads"
import { handleError } from "@/utils"
import { type Item, Main } from "./Main"
import { User } from "./User"

export function AppSidebar() {
  const { user: currentUser } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data: threadsData } = useQuery({
    queryKey: THREADS_QUERY_KEY,
    queryFn: listThreads,
  })

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const createThreadMutation = useMutation({
    mutationFn: (title: string) => createThread({ title }),
    onSuccess: (thread) => {
      showSuccessToast("Thread created")
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
      setIsCreateDialogOpen(false)
      if (thread?.thread_id) {
        navigate({ to: `/workspace/${thread.thread_id}` })
      } else {
        navigate({ to: "/workspace" })
      }
      if (isMobile) {
        setOpenMobile(false)
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const threadChildren = (threadsData?.data ?? [])
    .filter((thread) => thread.thread_id && thread.user_id)
    .map((thread) => ({
      title: getThreadTitle(thread.title),
      threadTitle: thread.title,
      path: `/workspace/${thread.thread_id}`,
      threadId: thread.thread_id,
    }))

  const baseItems: Item[] = [
    { icon: Home, title: "Dashboard", path: "/" },
    { icon: Briefcase, title: "Items", path: "/items" },
    {
      icon: LayoutGrid,
      title: "Workspace",
      path: "/workspace",
      children: threadChildren.length > 0 ? threadChildren : undefined,
      action: {
        icon: Plus,
        label: "New Thread",
        onClick: () => setIsCreateDialogOpen(true),
        disabled: createThreadMutation.isPending,
      },
    },
  ]

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Admin", path: "/admin" }]
    : baseItems

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
          <Logo variant="responsive" />
        </SidebarHeader>
        <SidebarContent>
          <Main items={items} />
        </SidebarContent>
        <SidebarFooter>
          <SidebarAppearance />
          <User user={currentUser} />
        </SidebarFooter>
      </Sidebar>
      <CreateThreadDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        isSubmitting={createThreadMutation.isPending}
        onConfirm={(title) => createThreadMutation.mutate(title)}
      />
    </>
  )
}

export default AppSidebar
