import path from 'node:path'

export interface FolderLike {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
}

export type WithChildren<T> = T & { children: WithChildren<T>[] }

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

export function sortFoldersForTree<T extends FolderLike>(folders: T[]): T[] {
  const folderByParent = new Map<number | null, T[]>()
  const knownFolderIds = new Set<number>(folders.map(folder => folder.id))

  folders.forEach((folder) => {
    const parentId
      = folder.parentId !== null && knownFolderIds.has(folder.parentId)
        ? folder.parentId
        : null
    const siblings = folderByParent.get(parentId) || []

    siblings.push(folder)
    folderByParent.set(parentId, siblings)
  })

  folderByParent.forEach((siblings) => {
    siblings.sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) {
        return a.orderIndex - b.orderIndex
      }

      return a.id - b.id
    })
  })

  const orderedFolders: T[] = []
  const visitedFolderIds = new Set<number>()

  const visitChildren = (parentId: number | null): void => {
    const children = folderByParent.get(parentId) || []
    children.forEach((child) => {
      if (visitedFolderIds.has(child.id)) {
        return
      }

      visitedFolderIds.add(child.id)
      orderedFolders.push(child)
      visitChildren(child.id)
    })
  }

  visitChildren(null)

  folders.forEach((folder) => {
    if (visitedFolderIds.has(folder.id)) {
      return
    }

    visitedFolderIds.add(folder.id)
    orderedFolders.push(folder)
    visitChildren(folder.id)
  })

  return orderedFolders
}

export function buildFolderTree<T extends FolderLike>(
  folders: T[],
): WithChildren<T>[] {
  const folderMap = new Map<number, WithChildren<T>>()
  const rootFolders: WithChildren<T>[] = []

  folders.forEach((folder) => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
    })
  })

  folderMap.forEach((folder) => {
    if (folder.parentId === null) {
      rootFolders.push(folder)
      return
    }

    const parent = folderMap.get(folder.parentId)
    if (parent) {
      parent.children.push(folder)
    }
    else {
      rootFolders.push(folder)
    }
  })

  return rootFolders
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
