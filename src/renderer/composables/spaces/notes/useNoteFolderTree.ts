// --- Types ---

export interface NoteFolderTreeItem {
  id: number
  name: string
  createdAt: number
  updatedAt: number
  icon: string | null
  parentId: number | null
  isOpen: number
  orderIndex: number
  children: NoteFolderTreeItem[]
}

export type NoteFoldersTreeResponse = NoteFolderTreeItem[]

// --- Pure tree utility functions ---

function flattenFolderTree(
  nodes?: NoteFoldersTreeResponse,
  acc: NoteFolderTreeItem[] = [],
) {
  if (!nodes) {
    return acc
  }

  nodes.forEach((folder) => {
    acc.push(folder)

    if (folder.children?.length) {
      flattenFolderTree(folder.children, acc)
    }
  })

  return acc
}

function getFolderByIdFromTree(
  nodes: NoteFolderTreeItem[] | undefined,
  id: number | null,
): NoteFolderTreeItem | undefined {
  if (!nodes || id === null) {
    return undefined
  }
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    if (node.children?.length) {
      const foundFolder = getFolderByIdFromTree(node.children, id)
      if (foundFolder) {
        return foundFolder
      }
    }
  }
}

function findParentFolderIds(
  folderId: number,
  allFolders: NoteFolderTreeItem[],
): number[] {
  const parentIds: number[] = []

  function findParents(currentFolderId: number) {
    const folder = allFolders.find(
      (f: NoteFolderTreeItem) => f.id === currentFolderId,
    )
    if (folder && folder.parentId) {
      parentIds.push(folder.parentId)
      findParents(folder.parentId)
    }
  }

  findParents(folderId)
  return parentIds
}

export { findParentFolderIds, flattenFolderTree, getFolderByIdFromTree }

export function useNoteFolderTree() {
  return {
    flattenFolderTree,
    getFolderByIdFromTree,
    findParentFolderIds,
  }
}
