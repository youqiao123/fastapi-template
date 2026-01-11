import { apiBase } from "@/lib/api"
import {
  type ArtifactItem,
  type ArtifactRecord,
} from "@/types/artifact"

type ArtifactApiResponse = {
  data: ArtifactApiRecord[]
  count: number
}

type ArtifactApiRecord = {
  id: string
  type: string
  path: string
  asset_id: string
  is_folder: boolean
  thread_id: string
  user_id?: string
  created_at: string
}

const toDisplayArtifact = (artifact: ArtifactApiRecord): ArtifactRecord => ({
  id: artifact.id,
  type: artifact.type,
  path: artifact.path,
  assetId: artifact.asset_id,
  isFolder: artifact.is_folder,
  threadId: artifact.thread_id,
  createdAt: artifact.created_at,
  userId: artifact.user_id,
})

const authHeaders = () => {
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export const saveArtifacts = async (
  artifacts: ArtifactItem[],
  threadId: string,
): Promise<ArtifactRecord[]> => {
  if (!artifacts.length) {
    return []
  }

  const payload = {
    artifacts: artifacts.map((artifact) => ({
      type: artifact.type,
      path: artifact.path,
      asset_id: artifact.assetId,
      is_folder: artifact.isFolder,
      thread_id: threadId,
    })),
  }

  const response = await fetch(`${apiBase}/api/v1/artifacts/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeaders() ?? {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to save artifacts")
  }

  const data: ArtifactApiResponse = await response.json()
  return data.data.map(toDisplayArtifact)
}

export const listArtifacts = async (
  params: { threadId?: string; skip?: number; limit?: number } = {},
): Promise<ArtifactRecord[]> => {
  const searchParams = new URLSearchParams()
  if (params.threadId) {
    searchParams.set("thread_id", params.threadId)
  }
  if (typeof params.skip === "number") {
    searchParams.set("skip", `${params.skip}`)
  }
  if (typeof params.limit === "number") {
    searchParams.set("limit", `${params.limit}`)
  }

  // Keep trailing slash to avoid FastAPI's 307 redirect on the root list route
  const baseUrl = `${apiBase}/api/v1/artifacts/`
  const url =
    searchParams.toString().length > 0
      ? `${baseUrl}?${searchParams.toString()}`
      : baseUrl

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      ...(authHeaders() ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to load artifacts")
  }

  const data: ArtifactApiResponse = await response.json()
  return data.data.map(toDisplayArtifact)
}

export const deleteArtifact = async (artifactId: string): Promise<void> => {
  const response = await fetch(`${apiBase}/api/v1/artifacts/${artifactId}`, {
    method: "DELETE",
    headers: {
      ...(authHeaders() ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to delete artifact")
  }
}

const getFileName = (path: string, fallback: string) => {
  const parts = path.split("/").filter(Boolean)
  const name = parts[parts.length - 1]
  return name || fallback
}

export const downloadArtifact = async (
  artifact: Pick<ArtifactRecord, "id" | "path">,
): Promise<void> => {
  const response = await fetch(
    `${apiBase}/api/v1/artifacts/${artifact.id}/download`,
    {
      headers: {
        ...(authHeaders() ?? {}),
      },
    },
  )

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to download artifact")
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = getFileName(artifact.path, `artifact-${artifact.id}`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const fetchArtifactText = async (
  artifact: Pick<ArtifactRecord, "id" | "path">,
  options?: { signal?: AbortSignal },
): Promise<string> => {
  const response = await fetch(
    `${apiBase}/api/v1/artifacts/${artifact.id}/download`,
    {
      headers: {
        ...(authHeaders() ?? {}),
      },
      signal: options?.signal,
    },
  )

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to load artifact")
  }

  return response.text()
}
