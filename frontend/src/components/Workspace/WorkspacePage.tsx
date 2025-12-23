import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ArtifactPanel } from "@/components/Workspace/ArtifactPanel"
import { ChatPanel } from "@/components/Workspace/ChatPanel"
import { cn } from "@/lib/utils"

type WorkspacePageProps = {
  threadId?: string
}

export function WorkspacePage({ threadId }: WorkspacePageProps) {
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(true)

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsArtifactsOpen((prev) => !prev)}
        >
          {isArtifactsOpen ? "Hide Artifacts" : "Show Artifacts"}
        </Button>
      </div>

      <div
        className={cn(
          "flex flex-1 min-h-0 flex-col gap-4 transition-[gap] duration-200 ease-linear lg:flex-row lg:items-stretch",
          isArtifactsOpen ? "lg:gap-4" : "lg:gap-0",
        )}
      >
        <div
          className={cn(
            "w-full flex-1 transition-[max-width,margin-left,width] duration-200 ease-linear lg:flex lg:flex-col",
            isArtifactsOpen
              ? "lg:ml-0 lg:w-80 lg:max-w-80 lg:flex-none"
              : "lg:ml-[max(0px,calc((100%-56rem)/2))] lg:max-w-4xl lg:flex-1",
          )}
        >
          <ChatPanel threadId={threadId} />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-[width,max-height,opacity] duration-200 ease-linear lg:flex lg:flex-col lg:h-full",
            isArtifactsOpen
              ? "max-h-[500px] opacity-100 lg:w-[calc(100%-20rem-1rem)] lg:max-h-none"
              : "max-h-0 opacity-0 lg:w-0 lg:max-h-none",
          )}
        >
          <div
            className={cn(
              "transition-transform duration-200 ease-linear lg:flex-1 lg:h-full",
              isArtifactsOpen ? "lg:translate-x-0" : "lg:translate-x-full",
            )}
          >
            <ArtifactPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
