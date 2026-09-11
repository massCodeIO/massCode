import type { HttpCollectionConfig } from '../../shared/httpCollection'
import {
  httpFolderChain,
  readHttpCollection,
  resolveHttpFolderConfig,
} from '../../shared/httpCollection'
import { useHttpStorage } from '../storage'

export interface ResolvedHttpCollection {
  id: number
  createdAt: number
  config?: HttpCollectionConfig
  scopes?: { id: number, config?: HttpCollectionConfig }[]
}
export function resolveHttpCollection(
  folderId: number | null | undefined,
): ResolvedHttpCollection | null {
  if (folderId == null)
    return null
  const folders = useHttpStorage().folders.getFolders()
  const chain = httpFolderChain(folders, folderId)
  const root = chain[0]
  if (!root)
    return null
  return {
    id: root.id,
    createdAt: root.createdAt,
    config: resolveHttpFolderConfig(folders, folderId),
    scopes: chain.map(folder => ({
      id: folder.id,
      config: readHttpCollection(folder),
    })),
  }
}
