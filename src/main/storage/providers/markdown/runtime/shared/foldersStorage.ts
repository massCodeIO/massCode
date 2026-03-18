import path from 'node:path'
import {
  buildFolderTree,
  type FolderLike,
  sortFoldersForTree,
  type WithChildren,
} from './folderIndex'

export function getFoldersSortedByCreatedAt<
  T extends {
    createdAt: number
  },
>(folders: T[]): T[] {
  return [...folders].sort((a, b) => b.createdAt - a.createdAt)
}

export function getFoldersTreeSorted<T extends FolderLike>(
  folders: T[],
): WithChildren<T>[] {
  return buildFolderTree(sortFoldersForTree([...folders]))
}

export function resolveFolderRelativePath(
  folderPathMap: ReadonlyMap<number, string>,
  parentId: number | null,
  name: string,
): string {
  const parentPath
    = parentId !== null ? folderPathMap.get(parentId) : undefined
  return parentPath ? path.posix.join(parentPath, name) : name
}
