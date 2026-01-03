import { type ArtifactItem } from "@/types/artifact"

export type PreviewMode = "smiles" | "structure" | "unsupported"

const isLinkerDesignCsv = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
) =>
  artifact.type === "linker_design_output" &&
  artifact.path.toLowerCase().endsWith(".csv") &&
  !artifact.isFolder

const isTernaryStructure = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
) =>
  artifact.type === "ternary_complex_structure" &&
  !artifact.isFolder &&
  (artifact.path.toLowerCase().endsWith(".pdb") ||
    artifact.path.toLowerCase().endsWith(".cif"))

export const getStructureFormat = (
  path: string,
): "pdb" | "cif" => (path.toLowerCase().endsWith(".cif") ? "cif" : "pdb")

export const getPreviewMode = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
): PreviewMode => {
  if (isLinkerDesignCsv(artifact)) return "smiles"
  if (isTernaryStructure(artifact)) return "structure"
  return "unsupported"
}

const splitCsvLine = (rawLine: string): string[] => {
  const line = rawLine.replace(/\r$/, "")
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      const next = line[index + 1]
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }

  cells.push(current)
  return cells
}

const normalizeCell = (cell: string) => cell.trim().replace(/^"|"$/g, "")

export const parseSmilesFromCsv = (csvText: string): string[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  if (!lines.length) return []

  const headers = splitCsvLine(lines[0]).map((cell) =>
    normalizeCell(cell).toLowerCase(),
  )
  const smilesIndex = headers.findIndex((header) => header === "smiles")
  if (smilesIndex === -1) return []

  const smiles: string[] = []
  for (const rawLine of lines.slice(1)) {
    const cells = splitCsvLine(rawLine)
    const value = normalizeCell(cells[smilesIndex] ?? "")
    if (value) {
      smiles.push(value)
    }
  }

  return smiles
}
