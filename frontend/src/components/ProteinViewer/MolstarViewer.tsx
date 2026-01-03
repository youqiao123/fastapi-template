import { useEffect, useRef } from "react"
import { PluginContext } from "molstar/lib/mol-plugin/context"
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec"
import "molstar/build/viewer/molstar.css"

import { cn } from "@/lib/utils"

type StructureFormat = "pdb" | "cif"

type Props = {
  data: string
  format: StructureFormat
  height?: number
  className?: string
}

export function MolstarViewer({
  data,
  format,
  height = 480,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pluginRef = useRef<PluginContext | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const plugin = new PluginContext(DefaultPluginSpec())
    pluginRef.current = plugin
    let cancelled = false

    const init = async () => {
      await plugin.init()
      if (cancelled) return

      const mounted = await plugin.mountAsync(container, {
        checkeredCanvasBackground: true,
      })
      if (!mounted || cancelled) return

      const dataCell = await plugin.builders.data.rawData({
        data,
        label: `structure.${format}`,
      })
      if (cancelled) return

      const formatId = format === "cif" ? "mmcif" : "pdb"
      const trajectory = await plugin.builders.structure.parseTrajectory(
        dataCell,
        formatId,
      )
      if (cancelled) return

      await plugin.builders.structure.hierarchy.applyPreset(
        trajectory,
        "default",
      )
    }

    init().catch((err) => {
      if (cancelled) return
      console.error("Mol* failed to load structure", err)
    })

    return () => {
      cancelled = true
      pluginRef.current?.dispose()
      pluginRef.current = null
    }
  }, [data, format])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-card shadow-sm",
        className,
      )}
      style={{ height }}
    />
  )
}
