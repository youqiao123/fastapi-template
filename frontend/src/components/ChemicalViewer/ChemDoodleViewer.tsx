import { useEffect, useMemo, useState } from "react"

import { ensureChemDoodle } from "@/lib/chemdoodle"

type Props = {
  smiles?: string
  molfile?: string
  width?: number
  height?: number
  className?: string
}

export function ChemDoodleViewer({
  smiles,
  molfile,
  width = 320,
  height = 320,
  className,
}: Props) {
  const canvasId = useMemo(
    () => `chem-viewer-${Math.random().toString(36).slice(2, 10)}`,
    [],
  )
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setReady(false)

    ensureChemDoodle()
      .then((cd) => {
        if (cancelled) return
        if (!cd) {
          setError("ChemDoodle failed to load. Check network tab for 404.")
          return
        }
        const canvas = new cd.ViewerCanvas(canvasId, width, height)
        let molecule = null

        if (molfile) {
          molecule = cd.readMOL(molfile)
        } else if (smiles && typeof cd.readSMILES === "function") {
          try {
            molecule = cd.readSMILES(smiles)
          } catch (e) {
            console.warn("readSMILES threw, falling back to error", e)
          }
        }

        if (!molecule) {
          setError(
            "No molecule to render. Provide molfile (preferred) or ensure readSMILES is available.",
          )
          return
        }

        canvas.loadMolecule(molecule)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load ChemDoodle")
        console.error(err)
      })

    return () => {
      cancelled = true
    }
  }, [canvasId, smiles, width, height])

  return (
    <div className="flex flex-col gap-2">
      <canvas
        id={canvasId}
        width={width}
        height={height}
        className={className}
      />
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : !ready ? (
        <span className="text-xs text-muted-foreground">
          Loading Chemdoodle…
        </span>
      ) : null}
    </div>
  )
}
