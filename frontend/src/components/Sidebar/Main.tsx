import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThreadActionsMenu } from "@/components/Sidebar/ThreadActionsMenu"
import { cn } from "@/lib/utils"

export type SubItem = {
  title: string
  path: string
  threadId?: string
  threadTitle?: string | null
}

export type ItemAction = {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}

export type Item = {
  icon: LucideIcon
  title: string
  path: string
  children?: SubItem[]
  action?: ItemAction
}

interface MainProps {
  items: Item[]
}

export function Main({ items }: MainProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouterState()
  const currentPath = router.location.pathname

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              currentPath === item.path ||
              item.children?.some((child) => child.path === currentPath)

            const shouldShowChildren = Boolean(item.children?.length)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  asChild
                >
                  <RouterLink to={item.path} onClick={handleMenuClick}>
                    <item.icon />
                    <span>{item.title}</span>
                  </RouterLink>
                </SidebarMenuButton>
                {item.action ? (
                  <SidebarMenuAction
                    type="button"
                    aria-label={item.action.label}
                    title={item.action.label}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      item.action?.onClick()
                    }}
                    disabled={item.action.disabled}
                  >
                    <item.action.icon />
                  </SidebarMenuAction>
                ) : null}
                {shouldShowChildren ? (
                  <div
                    aria-hidden={!isActive}
                    className={cn(
                      "grid overflow-hidden transition-all duration-200 ease-out",
                      isActive
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="min-h-0">
                      <SidebarMenuSub>
                        {item.children.map((child) => {
                          const isChildActive = currentPath === child.path
                          const hasThreadActions = Boolean(child.threadId)

                          return (
                            <SidebarMenuSubItem key={child.path}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isChildActive}
                                className={cn(hasThreadActions && "pr-8")}
                              >
                                <RouterLink
                                  to={child.path}
                                  onClick={handleMenuClick}
                                  tabIndex={isActive ? 0 : -1}
                                >
                                  <span>{child.title}</span>
                                </RouterLink>
                              </SidebarMenuSubButton>
                              {hasThreadActions ? (
                                <ThreadActionsMenu
                                  threadId={child.threadId ?? ""}
                                  title={child.title}
                                  threadTitle={child.threadTitle}
                                  isParentActive={isActive}
                                />
                              ) : null}
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </div>
                  </div>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
