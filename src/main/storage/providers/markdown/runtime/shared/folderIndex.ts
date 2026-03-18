import path from 'node:path'

export interface FolderLike {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
}

export function buildFolderPathMap<T extends FolderLike>(
  folders: T[],
): Map<number, string> {
  const folderById = new Map<number, T>()
  folders.forEach(folder => folderById.set(folder.id, folder))

  const resolvedMap = new Map<number, string>()
  const visiting = new Set<number>()

  const resolveFolderPath = (folderId: number): string => {
    const existingPath = resolvedMap.get(folderId)
    if (existingPath !== undefined) {
      return existingPath
    }

    const folder = folderById.get(folderId)
    if (!folder) {
      return ''
    }

    if (visiting.has(folderId)) {
      return folder.name
    }

    visiting.add(folderId)

    const parentPath
      = folder.parentId !== null ? resolveFolderPath(folder.parentId) : ''
    const currentPath = parentPath
      ? path.posix.join(parentPath, folder.name)
      : folder.name

    resolvedMap.set(folderId, currentPath)
    visiting.delete(folderId)

    return currentPath
  }

  folders.forEach(folder => resolveFolderPath(folder.id))

  return resolvedMap
}

export function buildPathToFolderIdMap<T extends FolderLike>(
  folders: T[],
): Map<string, number> {
  const folderPathMap = buildFolderPathMap(folders)
  const pathMap = new Map<string, number>()

  folderPathMap.forEach((folderPath, folderId) => {
    pathMap.set(folderPath, folderId)
  })

  return pathMap
}

export function findFolderByIdPure<T extends FolderLike>(
  folders: T[],
  folderId: number,
): T | undefined {
  return folders.find(item => item.id === folderId)
}

export function getFolderSiblings<T extends FolderLike>(
  folders: T[],
  parentId: number | null,
  excludeId?: number,
): T[] {
  return folders.filter((folder) => {
    if (folder.parentId !== parentId) {
      return false
    }

    if (excludeId !== undefined && folder.id === excludeId) {
      return false
    }

    return true
  })
}

export function getNextFolderOrder<T extends FolderLike>(
  folders: T[],
  parentId: number | null,
): number {
  return (
    folders
      .filter(folder => folder.parentId === parentId)
      .reduce((maxOrder, folder) => Math.max(maxOrder, folder.orderIndex), -1)
      + 1
  )
}

export function collectDescendantIds<T extends FolderLike>(
  folders: T[],
  parentId: number,
): Set<number> {
  const descendantIds = new Set<number>()
  const visited = new Set<number>()

  function collect(targetParentId: number): void {
    if (visited.has(targetParentId)) {
      return
    }
    visited.add(targetParentId)
    for (const folder of folders) {
      if (
        folder.parentId === targetParentId
        && folder.id !== parentId
        && !descendantIds.has(folder.id)
      ) {
        descendantIds.add(folder.id)
        collect(folder.id)
      }
    }
  }

  collect(parentId)
  return descendantIds
}
