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
  const { resolvedTheme } = useTheme()
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!smiles.trim()) {
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
          drawer.draw(smiles.trim(), svg, resolvedTheme, onSuccess, onError)
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
  }, [smiles, width, height, resolvedTheme])

  return (
    <div className="mx-auto flex w-fit flex-col gap-2">
      <div
        className={cn(
          "relative inline-block h-fit w-fit rounded-lg border bg-card/40 p-3 shadow-sm",
          className,
        )}
      >
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
      {showSmiles ? (
        <span className="text-xs text-muted-foreground break-all">
          SMILES: {smiles}
        </span>
      ) : null}
    </div>
  )
}
