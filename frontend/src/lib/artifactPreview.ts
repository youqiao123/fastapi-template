import { type ArtifactItem } from "@/types/artifact"

export type PreviewMode = "smiles" | "structure" | "sequence" | "unsupported"

const isLinkerDesignCsv = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
) =>
  artifact.type === "linker_design_output" &&
  artifact.path.toLowerCase().endsWith(".csv") &&
  !artifact.isFolder

const isTernaryStructure = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
) => {
  if (artifact.type !== "ternary_complex_structure") return false
  if (artifact.isFolder) return true

  const path = artifact.path.toLowerCase()
  return path.endsWith(".pdb") || path.endsWith(".cif")
}

const sequenceExtensions = [".fasta", ".fa", ".faa"]

const isSequenceArtifact = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
) => {
  if (artifact.isFolder) return false
  const typeMatch = artifact.type.toLowerCase().includes("sequence")
  const path = artifact.path.toLowerCase()
  const extensionMatch = sequenceExtensions.some((ext) => path.endsWith(ext))
  return typeMatch || extensionMatch
}

export const getStructureFormat = (
  path: string,
  fallback: "pdb" | "cif" = "pdb",
): "pdb" | "cif" =>
  path.toLowerCase().endsWith(".cif")
    ? "cif"
    : path.toLowerCase().endsWith(".pdb")
      ? "pdb"
      : fallback

const COMPLEX_MODEL_PREFIX = "complex_model_"
const DEFAULT_COMPLEX_MODEL_FILE = "complex_model_0.cif"

const parseComplexModelIndex = (filename: string) => {
  const match = filename.match(/complex_model_(\d+)\.cif$/i)
  return match ? Number.parseInt(match[1] ?? "", 10) : null
}

export const getComplexModelFiles = (filenames: string[]): string[] =>
  filenames
    .filter((filename) => {
      const lower = filename.toLowerCase()
      return (
        lower.startsWith(COMPLEX_MODEL_PREFIX) &&
        lower.endsWith(".cif")
      )
    })
    .sort((a, b) => {
      const indexA = parseComplexModelIndex(a)
      const indexB = parseComplexModelIndex(b)

      if (indexA !== null && indexB !== null) {
        return indexA - indexB
      }
      if (indexA !== null) return -1
      if (indexB !== null) return 1
      return a.localeCompare(b)
    })

export const getDefaultComplexModelIndex = (files: string[]): number => {
  const targetIndex = files.findIndex(
    (file) => file.toLowerCase() === DEFAULT_COMPLEX_MODEL_FILE,
  )
  return targetIndex === -1 ? 0 : targetIndex
}

export const getPreviewMode = (
  artifact: Pick<ArtifactItem, "type" | "path" | "isFolder">,
): PreviewMode => {
  if (isLinkerDesignCsv(artifact)) return "smiles"
  if (isTernaryStructure(artifact)) return "structure"
  if (isSequenceArtifact(artifact)) return "sequence"
  return "unsupported"
}

const splitCsvLine = (rawLine: string, delimiter = ","): string[] => {
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
    if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }

  cells.push(current)
  return cells
}

const stripBom = (value: string) => value.replace(/^\uFEFF/, "")

const normalizeCell = (cell: string) =>
  stripBom(cell).trim().replace(/^"|"$/g, "")

export const parseSmilesFromCsv = (csvText: string): string[] => {
  const rawLines = stripBom(csvText)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  if (!rawLines.length) return []

  const sepMatch = rawLines[0]?.trim().match(/^sep=(.)$/i)
  let delimiter = sepMatch?.[1] ?? ","
  const lines = sepMatch ? rawLines.slice(1) : rawLines

  if (!lines.length) return []

  if (!sepMatch) {
    const candidateDelimiters = [",", ";", "\t"]
    delimiter = candidateDelimiters.reduce((best, current) => {
      const bestCount = splitCsvLine(lines[0], best).length
      const currentCount = splitCsvLine(lines[0], current).length
      return currentCount > bestCount ? current : best
    }, delimiter)
  }

  const headers = splitCsvLine(lines[0], delimiter).map((cell) =>
    normalizeCell(cell).toLowerCase(),
  )
  const smilesIndex = headers.findIndex((header) => header === "smiles")
  if (smilesIndex === -1) return []

  const smiles: string[] = []
  for (const rawLine of lines.slice(1)) {
    const cells = splitCsvLine(rawLine, delimiter)
    const value = normalizeCell(cells[smilesIndex] ?? "")
    if (value) {
      smiles.push(value)
    }
  }

  return smiles
}

export type ParsedSequence = {
  id: string
  description?: string
  sequence: string
}

const sanitizeSequenceLine = (line: string) =>
  line.replace(/[^A-Za-z*\-]/g, "").toUpperCase()

export const parseSequencesFromText = (text: string): ParsedSequence[] => {
  const lines = text.split(/\r?\n/)
  const sequences: ParsedSequence[] = []
  let currentId = ""
  let currentDescription: string | undefined
  let currentParts: string[] = []

  const pushCurrent = () => {
    if (!currentParts.length) return
    const sequence = currentParts.join("")
    if (!sequence) return
    sequences.push({
      id: currentId || `Sequence ${sequences.length + 1}`,
      description: currentDescription,
      sequence,
    })
    currentId = ""
    currentDescription = undefined
    currentParts = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith(">")) {
      pushCurrent()
      const header = line.slice(1).trim()
      const [id, ...rest] = header.split(/\s+/)
      currentId = id || `Sequence ${sequences.length + 1}`
      const description = rest.join(" ").trim()
      currentDescription = description ? description : undefined
      continue
    }

    const sanitized = sanitizeSequenceLine(line)
    if (!sanitized) continue
    if (!currentId) {
      currentId = `Sequence ${sequences.length + 1}`
    }
    currentParts.push(sanitized)
  }

  pushCurrent()

  if (!sequences.length) {
    const fallback = sanitizeSequenceLine(text)
    if (fallback) {
      sequences.push({
        id: "Sequence 1",
        sequence: fallback,
      })
    }
  }

  return sequences
}
