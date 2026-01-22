import { useEffect, useRef, useState } from "react"

import { ensureSmilesDrawer } from "@/lib/smilesDrawer"
import { moleculeOptions } from "@/lib/smilesDrawerOptions"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

type Status = "idle" | "loading" | "ready" | "error"

type Props = {
  smiles: string
  width?: number
  height?: number
  className?: string
  showSmiles?: boolean
}

export function SmilesDrawerViewer({
  smiles,
  width = moleculeOptions.width,
  height = moleculeOptions.height,
  className,
  showSmiles = true,
}: Props) {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isSmilesVisible, setIsSmilesVisible] = useState(false)
  const { resolvedTheme } = useTheme()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const trimmedSmiles = smiles.trim()
  const hasSmiles = Boolean(trimmedSmiles)

  useEffect(() => {
    setIsSmilesVisible(false)
  }, [smiles])

  useEffect(() => {
    if (!isSmilesVisible) return
    if (typeof document === "undefined") return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target)) return
      if (toggleButtonRef.current?.contains(target)) return
      setIsSmilesVisible(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isSmilesVisible])

  useEffect(() => {
    let cancelled = false

    if (!trimmedSmiles) {
      setStatus("error")
      setError("Enter a valid SMILES string")
      return
    }

    setStatus("loading")
    setError(null)

    ensureSmilesDrawer()
      .then((SmiDrawer) => {
        if (cancelled) return

        const svg = svgRef.current
        if (!svg) {
          setError("SVG is not ready")
          setStatus("error")
          return
        }

        const options = {
          ...moleculeOptions,
          width,
          height,
        }

        svg.setAttribute("width", `${width}`)
        svg.setAttribute("height", `${height}`)

        const drawer = new SmiDrawer(options)

        const onSuccess = () => {
          if (cancelled) return
          svg.style.width = `${width}px`
          svg.style.height = `${height}px`
          setStatus("ready")
        }

        const onError = (err: unknown) => {
          if (cancelled) return
          const message =
            err instanceof Error ? err.message : "Failed to parse the SMILES string."
          setError(message)
          setStatus("error")
        }

        try {
          drawer.draw(trimmedSmiles, svg, resolvedTheme, onSuccess, onError)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "smiles-drawer rendering failed."
          setError(message)
          setStatus("error")
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load smiles-drawer from /vendor/smiles-drawer.",
        )
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [trimmedSmiles, width, height, resolvedTheme])

  return (
    <div className="mx-auto flex w-fit flex-col gap-2">
      <div
        className={cn(
          "relative inline-block h-fit w-fit rounded-lg border bg-card/40 p-3 shadow-sm",
          className,
        )}
      >
        {showSmiles && hasSmiles ? (
          <>
            <button
              ref={toggleButtonRef}
              type="button"
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={isSmilesVisible ? "Hide SMILES" : "Show SMILES"}
              aria-pressed={isSmilesVisible}
              title={isSmilesVisible ? "Hide SMILES" : "Show SMILES"}
              onClick={() => setIsSmilesVisible((prev) => !prev)}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 4h6l3 3v13H6V7l3-3Z" />
                <path d="M9 12h6" />
                <path d="M9 16h4" />
              </svg>
            </button>
            {isSmilesVisible ? (
              <div
                ref={popoverRef}
                className="absolute right-2 top-9 z-10 max-w-[260px] rounded-md border border-border/70 bg-background/95 px-2 py-1 text-[11px] text-muted-foreground shadow-md backdrop-blur"
              >
                <span className="sr-only">SMILES</span>
                <span className="break-all font-mono text-foreground">
                  {trimmedSmiles}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
        <svg
          ref={svgRef}
          className={cn(
            "block max-h-none max-w-none rounded-md border-0 bg-background",
            status === "loading" && "opacity-60",
          )}
          width={width}
          height={height}
          style={{ width, height }}
        />
        {status === "loading" ? (
          <span className="absolute text-xs text-muted-foreground">
            Rendering molecule...
          </span>
        ) : null}
        {status === "error" && error ? (
          <span className="absolute text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </div>
  )
}
