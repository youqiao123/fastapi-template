import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ArtifactPanel } from "@/components/Workspace/ArtifactPanel"
import { ChatPanel } from "@/components/Workspace/ChatPanel"
import { cn } from "@/lib/utils"

export function WorkspacePage() {
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(true)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace</h1>
          <p className="text-muted-foreground">
            Base layout for scientific agent workspaces.
          </p>
        </div>
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
          "flex min-h-[60vh] flex-col gap-4 transition-[gap] duration-200 ease-linear lg:flex-row",
          isArtifactsOpen ? "lg:gap-4" : "lg:gap-0",
        )}
      >
        <div
          className={cn(
            "w-full flex-1 transition-[max-width] duration-200 ease-linear lg:mx-auto",
            isArtifactsOpen ? "lg:max-w-full" : "lg:max-w-3xl",
          )}
        >
          <ChatPanel />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-[width,max-height,opacity] duration-200 ease-linear",
            isArtifactsOpen
              ? "max-h-[500px] opacity-100 lg:w-64 lg:max-h-none"
              : "max-h-0 opacity-0 lg:w-0 lg:max-h-none",
          )}
        >
          <div
            className={cn(
              "transition-transform duration-200 ease-linear",
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
