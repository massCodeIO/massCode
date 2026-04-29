interface FolderLike {
  id: number
  name: string
  parentId: number | null
}

export function buildNoteFolderPathMap(
  folders: FolderLike[],
): Map<number, string> {
  const folderById = new Map<number, FolderLike>()
  folders.forEach(folder => folderById.set(folder.id, folder))

  const resolved = new Map<number, string>()
  const visiting = new Set<number>()

  const resolve = (folderId: number): string => {
    const cached = resolved.get(folderId)
    if (cached !== undefined) {
      return cached
    }

    const folder = folderById.get(folderId)
    if (!folder) {
      return ''
    }

    if (visiting.has(folderId)) {
      return folder.name
    }

    visiting.add(folderId)
    const parentPath = folder.parentId !== null ? resolve(folder.parentId) : ''
    const currentPath = parentPath
      ? `${parentPath}/${folder.name}`
      : folder.name

    resolved.set(folderId, currentPath)
    visiting.delete(folderId)
    return currentPath
  }

  folders.forEach(folder => resolve(folder.id))
  return resolved
}
