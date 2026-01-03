import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react"
import { PanelRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ArtifactPanel } from "@/components/Workspace/ArtifactPanel"
import { ChatPanelContainer } from "@/components/Workspace/ChatPanelContainer"
import { cn } from "@/lib/utils"
import { listArtifacts } from "@/lib/artifacts"
import { type ArtifactDisplay } from "@/types/artifact"

type WorkspacePageProps = {
  threadId?: string
}

const GUTTER_WIDTH = 16
const DEFAULT_CHAT_WIDTH = 40 * 16
const MIN_CHAT_WIDTH = 20 * 16
const MIN_ARTIFACT_WIDTH = 20 * 16
const COLLAPSED_ARTIFACT_WIDTH = 3 * 16
const CLOSE_ANIMATION_MS = 200

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function WorkspacePage({ threadId }: WorkspacePageProps) {
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(false)
  const [isArtifactsClosing, setIsArtifactsClosing] = useState(false)
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)
  const [artifacts, setArtifacts] = useState<ArtifactDisplay[]>([])
  const [activeArtifact, setActiveArtifact] = useState<ArtifactDisplay | null>(
    null,
  )
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chatWidthRef = useRef(chatWidth)
  const closeTimeoutRef = useRef<number | null>(null)
  const lastOpenChatWidthRef = useRef(DEFAULT_CHAT_WIDTH)
  const dragStateRef = useRef<{
    startX: number
    startWidth: number
    containerWidth: number
  } | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const isArtifactsVisible = isArtifactsOpen || isArtifactsClosing
  const isArtifactsExpanded = isArtifactsOpen && !isArtifactsClosing
  const artifactsLabel = isArtifactsExpanded
    ? "Hide artifacts panel"
    : "Show artifacts panel"
  const resizeVars = isArtifactsVisible
    ? ({
        "--chat-width": `${chatWidth}px`,
        "--chat-min-width": `${MIN_CHAT_WIDTH}px`,
        "--artifact-min-width": `${MIN_ARTIFACT_WIDTH}px`,
      } as CSSProperties)
    : undefined

  const getArtifactKey = useCallback(
    (artifact: ArtifactDisplay) => `${artifact.assetId}-${artifact.path}`,
    [],
  )

  useEffect(() => {
    chatWidthRef.current = chatWidth
  }, [chatWidth])

  const updateArtifacts = useCallback(
    (incoming: ArtifactDisplay[], options?: { replace?: boolean }) => {
      setArtifacts((prev) => {
        const base = options?.replace ? [] : prev
        const merged = [...incoming, ...base]
        const seen = new Set<string>()
        const unique: ArtifactDisplay[] = []

        for (const artifact of merged) {
          const key = getArtifactKey(artifact)
          if (seen.has(key)) {
            continue
          }
          seen.add(key)
          unique.push(artifact)
        }

        return unique
      })
    },
    [getArtifactKey],
  )

  useEffect(() => {
    updateArtifacts([], { replace: true })
    if (!threadId) {
      return
    }

    let isActive = true
    listArtifacts({ threadId, limit: 50 })
      .then((data) => {
        if (isActive) {
          updateArtifacts(data, { replace: true })
        }
      })
      .catch((err) => {
        console.error("Failed to load artifacts", err)
      })

    return () => {
      isActive = false
    }
  }, [threadId, updateArtifacts])

  useEffect(() => {
    setActiveArtifact((current) => {
      if (!artifacts.length) {
        return null
      }

      if (!current) {
        return artifacts[0]
      }

      const key = getArtifactKey(current)
      const replacement = artifacts.find(
        (artifact) => getArtifactKey(artifact) === key,
      )
      return replacement ?? artifacts[0]
    })
  }, [artifacts, getArtifactKey])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isArtifactsExpanded) {
      return
    }

    const handleResize = () => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const { width } = container.getBoundingClientRect()
      const maxChatWidth = Math.max(
        MIN_CHAT_WIDTH,
        width - GUTTER_WIDTH - MIN_ARTIFACT_WIDTH,
      )
      const nextWidth = clamp(
        chatWidthRef.current,
        MIN_CHAT_WIDTH,
        maxChatWidth,
      )

      if (nextWidth === chatWidthRef.current) {
        return
      }

      setChatWidth(nextWidth)
      lastOpenChatWidthRef.current = nextWidth
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [isArtifactsExpanded])

  const openArtifacts = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }

    setIsArtifactsClosing(false)
    setIsArtifactsOpen(true)
    setChatWidth(lastOpenChatWidthRef.current)
  }

  const closeArtifacts = () => {
    if (!isArtifactsOpen || isArtifactsClosing) {
      return
    }

    const container = containerRef.current
    if (!container) {
      setIsArtifactsOpen(false)
      return
    }

    const { width } = container.getBoundingClientRect()
    lastOpenChatWidthRef.current = chatWidthRef.current
    const targetChatWidth = Math.max(
      MIN_CHAT_WIDTH,
      width - GUTTER_WIDTH - COLLAPSED_ARTIFACT_WIDTH,
    )

    setChatWidth(targetChatWidth)
    setIsArtifactsClosing(true)

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsArtifactsOpen(false)
      setIsArtifactsClosing(false)
      setChatWidth(lastOpenChatWidthRef.current)
      closeTimeoutRef.current = null
    }, CLOSE_ANIMATION_MS)
  }

  const handleArtifactsView = (incoming: ArtifactDisplay[]) => {
    if (!incoming.length) {
      return
    }

    openArtifacts()

    setActiveArtifact(() => {
      const target = incoming[0]
      const targetKey = getArtifactKey(target)
      const existing =
        artifacts.find(
          (artifact) => getArtifactKey(artifact) === targetKey,
        ) ?? null
      return existing ?? target
    })
  }

  const handleToggleArtifacts = () => {
    if (isArtifactsOpen && !isArtifactsClosing) {
      closeArtifacts()
      return
    }

    openArtifacts()
  }

  const handleGutterPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isArtifactsExpanded || event.button !== 0) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const { width } = container.getBoundingClientRect()

    dragStateRef.current = {
      startX: event.clientX,
      startWidth: chatWidth,
      containerWidth: width,
    }
    pointerIdRef.current = event.pointerId
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handleGutterPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !isDragging ||
      !isArtifactsExpanded ||
      pointerIdRef.current !== event.pointerId
    ) {
      return
    }

    const dragState = dragStateRef.current
    if (!dragState) {
      return
    }

    const delta = event.clientX - dragState.startX
    const availableWidth = dragState.containerWidth - GUTTER_WIDTH
    const maxChatWidth = Math.max(
      MIN_CHAT_WIDTH,
      availableWidth - MIN_ARTIFACT_WIDTH,
    )

    const nextWidth = clamp(
      dragState.startWidth + delta,
      MIN_CHAT_WIDTH,
      maxChatWidth,
    )

    setChatWidth(nextWidth)
    lastOpenChatWidthRef.current = nextWidth
  }

  const handleGutterPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    pointerIdRef.current = null
    dragStateRef.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div
        ref={containerRef}
        style={resizeVars}
        className={cn(
          "flex flex-1 min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0",
        )}
      >
        <div
          className={cn(
            "order-1 w-full min-h-0 lg:flex lg:flex-col",
            isDragging
              ? "lg:transition-none"
              : "transition-[width,max-width] duration-200 ease-linear",
            isArtifactsOpen
              ? "lg:flex-none lg:max-w-none lg:w-[var(--chat-width)] lg:min-w-[var(--chat-min-width)]"
              : "lg:flex-1 lg:max-w-4xl lg:mx-auto",
          )}
        >
          <ChatPanelContainer
            threadId={threadId}
            onArtifactsUpdate={updateArtifacts}
            onArtifactsView={handleArtifactsView}
          />
        </div>
        {isArtifactsVisible ? (
          <div
            role="separator"
            aria-label="Resize panels"
            aria-orientation="vertical"
            className={cn(
              "panel-gutter group order-2 hidden w-4 items-stretch justify-center touch-none select-none lg:flex",
              isDragging ? "bg-muted/40" : "hover:bg-muted/40",
              isArtifactsExpanded ? "cursor-col-resize" : "cursor-default",
              isArtifactsExpanded ? "pointer-events-auto" : "pointer-events-none",
            )}
            onPointerDown={handleGutterPointerDown}
            onPointerMove={handleGutterPointerMove}
            onPointerUp={handleGutterPointerUp}
            onPointerCancel={handleGutterPointerUp}
          />
        ) : null}
        <div
          className={cn(
            "order-2 flex w-full min-h-0 flex-col overflow-hidden rounded-lg border bg-muted/20 px-3 py-2 lg:h-full",
            isDragging
              ? "lg:transition-none"
              : "transition-[width,max-height,padding] duration-200 ease-linear",
            isArtifactsExpanded
              ? "gap-3 max-h-[500px] lg:max-h-none lg:flex-1 lg:min-w-[var(--artifact-min-width)] lg:px-4 lg:py-4"
              : "gap-0 max-h-14 lg:max-h-none lg:w-12 lg:flex-none lg:px-2 lg:py-4",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              isArtifactsExpanded ? "justify-between gap-3" : "justify-center",
            )}
          >
            {isArtifactsExpanded ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Artifacts
                </h2>
                {artifacts.length ? (
                  <span className="text-xs text-muted-foreground">
                    {artifacts.length} found
                  </span>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              variant={isArtifactsExpanded ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={handleToggleArtifacts}
              aria-label={artifactsLabel}
              aria-pressed={isArtifactsExpanded}
              title={artifactsLabel}
            >
              <PanelRightIcon />
            </Button>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 transition-[opacity,transform] duration-200 ease-linear",
              isArtifactsExpanded
                ? "opacity-100 translate-x-0"
                : "pointer-events-none opacity-0 translate-x-3",
            )}
          >
            <ArtifactPanel
              artifacts={artifacts}
              activeArtifact={activeArtifact}
              onArtifactSelect={(artifact) => setActiveArtifact(artifact)}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
