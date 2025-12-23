import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Briefcase,
  Home,
  LayoutGrid,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react"

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

  const createThreadMutation = useMutation({
    mutationFn: createThread,
    onSuccess: (thread) => {
      showSuccessToast("Thread created")
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
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
      path: `/workspace/${thread.thread_id}`,
    }))

  const baseItems: Item[] = [
    { icon: Home, title: "Dashboard", path: "/" },
    { icon: Briefcase, title: "Items", path: "/items" },
    { icon: MessageSquare, title: "Chat Stream", path: "/chat-stream" },
    {
      icon: LayoutGrid,
      title: "Workspace",
      path: "/workspace",
      children: threadChildren.length > 0 ? threadChildren : undefined,
      action: {
        icon: Plus,
        label: "New Thread",
        onClick: () => createThreadMutation.mutate(),
        disabled: createThreadMutation.isPending,
      },
    },
  ]

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Admin", path: "/admin" }]
    : baseItems

  return (
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
  )
}

export default AppSidebar
