export interface FolderMetadataSyncSource {
  createdAt?: unknown
  id?: unknown
  masscode_id?: unknown
  orderIndex?: unknown
  // Файл метаданных существует, но недокачан из облака: содержимое (и id)
  // сейчас неизвестно — в отличие от отсутствующего файла, для которого
  // легитимно чеканится новый id.
  unavailable?: boolean
  updatedAt?: unknown
}

export interface FolderDiskEntry<TMetadata extends FolderMetadataSyncSource> {
  metadata: TMetadata
  path: string
}
