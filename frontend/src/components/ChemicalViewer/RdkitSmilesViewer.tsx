import { useEffect, useState } from "react"
import type { JSMol } from "@rdkit/rdkit"

import { ensureRDKit } from "@/lib/rdkit"
import { cn } from "@/lib/utils"

type Status = "idle" | "loading" | "ready" | "error"

type Props = {
  smiles: string
  width?: number
  height?: number
  className?: string
  showSmiles?: boolean
}

export function RdkitSmilesViewer({
  smiles,
  width = 320,
  height = 240,
  className,
  showSmiles = true,
}: Props) {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let mol: JSMol | null = null

    if (!smiles) {
      setStatus("error")
      setError("Enter a valid SMILES string")
      setSvg(null)
      return
    }

    setStatus("loading")
    setError(null)
    setSvg(null)

    ensureRDKit()
      .then((rdkit) => {
        if (cancelled) return

        mol = rdkit.get_mol(smiles)
        if (!mol) {
          setStatus("error")
          setError("Unable to parse SMILES")
          return
        }

        const markup =
          width && height ? mol.get_svg(width, height) : mol.get_svg()

        setSvg(markup)
        setStatus("ready")
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setError(err instanceof Error ? err.message : "RDKit failed to load")
        setStatus("error")
      })

    return () => {
      cancelled = true
      if (mol) {
        mol.delete()
      }
    }
  }, [smiles, width, height])

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative flex min-h-[200px] items-center justify-center rounded-lg border bg-card/40 p-3 shadow-sm",
          className,
        )}
      >
        {svg ? (
          <div
            className="w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:max-h-[400px]"
            aria-label={`RDKit depiction for ${smiles}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : status === "loading" ? (
          <span className="text-xs text-muted-foreground">
            Rendering molecule...
          </span>
        ) : (
          <span className="text-xs text-destructive">
            {error ?? "Unable to render molecule"}
          </span>
        )}
      </div>
      {showSmiles ? (
        <span className="text-xs text-muted-foreground break-all">
          SMILES: {smiles}
        </span>
      ) : null}
    </div>
  )
}
