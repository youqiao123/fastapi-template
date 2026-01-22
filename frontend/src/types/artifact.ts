export type ArtifactItem = {
  type: string
  path: string
  isFolder: boolean
  assetId: string
  runId?: string
}

export type ArtifactDisplay = ArtifactItem & {
  id?: string
  threadId?: string
  createdAt?: string
}

export type ArtifactRecord = ArtifactItem & {
  id: string
  threadId: string
  createdAt: string
  userId?: string
}
