import { Link } from "@tanstack/react-router"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import icon from "/assets/images/agent-icon-dark.svg"
import iconLight from "/assets/images/agent-icon-light.svg"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const iconLogo = isDark ? iconLight : icon
  const brandName = "TPD-Agent"
  const brandAlt = "TPD-Agent"

  const content =
    variant === "responsive" ? (
      <>
        <div
          className={cn(
            "flex items-center gap-2 group-data-[collapsible=icon]:hidden",
            className,
          )}
        >
          <img src={iconLogo} alt={brandAlt} className="size-5" />
          <span className="text-sm font-semibold">{brandName}</span>
        </div>
        <img
          src={iconLogo}
          alt={brandAlt}
          className={cn(
            "size-5 hidden group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : variant === "full" ? (
      <div className={cn("flex items-center gap-2", className)}>
        <img src={iconLogo} alt={brandAlt} className="size-5" />
        <span className="text-sm font-semibold">{brandName}</span>
      </div>
    ) : (
      <img src={iconLogo} alt={brandAlt} className={cn("size-5", className)} />
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
