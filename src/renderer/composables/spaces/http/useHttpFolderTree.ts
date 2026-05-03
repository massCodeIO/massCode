export interface HttpFolderTreeItem {
  id: number
  name: string
  icon: string | null
  createdAt: number
  updatedAt: number
  parentId: number | null
  isOpen: number
  orderIndex: number
  children: HttpFolderTreeItem[]
}

export type HttpFoldersTreeResponse = HttpFolderTreeItem[]

function flattenFolderTree(
  nodes?: HttpFoldersTreeResponse,
  acc: HttpFolderTreeItem[] = [],
) {
  if (!nodes)
    return acc

  nodes.forEach((folder) => {
    acc.push(folder)

    if (folder.children?.length) {
      flattenFolderTree(folder.children, acc)
    }
  })

  return acc
}

function getFolderByIdFromTree(
  nodes: HttpFolderTreeItem[] | undefined,
  id: number | null,
): HttpFolderTreeItem | undefined {
  if (!nodes || id === null)
    return undefined

  for (const node of nodes) {
    if (node.id === id)
      return node

    if (node.children?.length) {
      const found = getFolderByIdFromTree(node.children, id)
      if (found)
        return found
    }
  }
}

function findParentFolderIds(
  folderId: number,
  allFolders: HttpFolderTreeItem[],
): number[] {
  const parentIds: number[] = []

  function walk(currentFolderId: number) {
    const folder = allFolders.find(f => f.id === currentFolderId)
    if (folder && folder.parentId) {
      parentIds.push(folder.parentId)
      walk(folder.parentId)
    }
  }

  walk(folderId)
  return parentIds
}

export { findParentFolderIds, flattenFolderTree, getFolderByIdFromTree }

export function useHttpFolderTree() {
  return {
    flattenFolderTree,
    getFolderByIdFromTree,
    findParentFolderIds,
  }
}
