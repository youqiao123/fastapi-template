import { useState } from "react"
import { PanelRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ArtifactPanel } from "@/components/Workspace/ArtifactPanel"
import { ChatPanelContainer } from "@/components/Workspace/ChatPanelContainer"
import { cn } from "@/lib/utils"

type WorkspacePageProps = {
  threadId?: string
}

export function WorkspacePage({ threadId }: WorkspacePageProps) {
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(false)
  const artifactsLabel = isArtifactsOpen
    ? "Hide artifacts panel"
    : "Show artifacts panel"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div
        className={cn(
          "flex flex-1 min-h-0 flex-col gap-4 transition-[gap] duration-200 ease-linear lg:flex-row lg:items-stretch",
          isArtifactsOpen ? "lg:gap-4" : "lg:gap-0",
        )}
      >
        <div
          className={cn(
            "order-1 w-full min-h-0 transition-[width,max-width] duration-200 ease-linear lg:flex lg:flex-col",
            isArtifactsOpen
              ? "lg:flex-none lg:w-80 lg:max-w-80"
              : "lg:flex-1 lg:max-w-4xl lg:mx-auto",
          )}
        >
          <ChatPanelContainer threadId={threadId} />
        </div>
        <div
          className={cn(
            "order-2 flex w-full min-h-0 flex-col overflow-hidden rounded-lg border bg-muted/20 px-3 py-2 transition-[width,max-height,padding] duration-200 ease-linear lg:flex-none lg:h-full lg:ml-auto",
            isArtifactsOpen
              ? "gap-3 max-h-[500px] lg:max-h-none lg:w-[calc(100%-20rem-1rem)] lg:px-4 lg:py-4"
              : "gap-0 max-h-14 lg:max-h-none lg:w-12 lg:px-2 lg:py-4",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              isArtifactsOpen ? "justify-end" : "justify-center",
            )}
          >
            <Button
              type="button"
              variant={isArtifactsOpen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setIsArtifactsOpen((prev) => !prev)}
              aria-label={artifactsLabel}
              aria-pressed={isArtifactsOpen}
              title={artifactsLabel}
            >
              <PanelRightIcon />
            </Button>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 transition-[opacity,transform] duration-200 ease-linear",
              isArtifactsOpen
                ? "opacity-100 translate-x-0"
                : "pointer-events-none opacity-0 translate-x-3",
            )}
          >
            <ArtifactPanel className="min-h-0 flex-1" />
          </div>
        </div>
      </div>
    </div>
  )
}
