import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type SubItem = {
  title: string
  path: string
}

export type Item = {
  icon: LucideIcon
  title: string
  path: string
  children?: SubItem[]
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

                          return (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isChildActive}
                              >
                                <RouterLink
                                  to={child.path}
                                  onClick={handleMenuClick}
                                  tabIndex={isActive ? 0 : -1}
                                >
                                  <span>{child.title}</span>
                                </RouterLink>
                              </SidebarMenuSubButton>
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
