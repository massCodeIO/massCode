import type { HttpCollectionConfig } from '../../shared/httpCollection'
import {
  findHttpCollection,
  readHttpCollection,
} from '../../shared/httpCollection'
import { useHttpStorage } from '../storage'

export interface ResolvedHttpCollection {
  id: number
  createdAt: number
  config?: HttpCollectionConfig
}
export function resolveHttpCollection(
  folderId: number | null | undefined,
): ResolvedHttpCollection | null {
  if (folderId == null)
    return null
  const root = findHttpCollection(
    useHttpStorage().folders.getFolders(),
    folderId,
  )
  if (!root)
    return null
  return {
    id: root.id,
    createdAt: root.createdAt,
    config: readHttpCollection(root),
  }
}
