export interface FolderMetadataSyncSource {
  createdAt?: unknown
  id?: unknown
  masscode_id?: unknown
  orderIndex?: unknown
  updatedAt?: unknown
}

export interface FolderDiskEntry<TMetadata extends FolderMetadataSyncSource> {
  metadata: TMetadata
  path: string
}
