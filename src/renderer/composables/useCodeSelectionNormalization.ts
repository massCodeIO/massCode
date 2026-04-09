import { useApp } from './useApp'
import { useFolders } from './useFolders'
import { useSnippets } from './useSnippets'
import { useTags } from './useTags'

interface FolderNode {
  id: number
  children?: FolderNode[]
}

const { state } = useApp()
const { folders } = useFolders()
const { displayedSnippets, getSnippets, selectFirstSnippet } = useSnippets()
const { tags } = useTags()

function flattenFolderTree(nodes?: FolderNode[], acc: FolderNode[] = []) {
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

export async function normalizeCodeSelectionState() {
  if (state.tagId && !tags.value.some(tag => tag.id === state.tagId)) {
    state.tagId = undefined
  }

  const orderedFolders = flattenFolderTree(folders.value)

  if (
    state.folderId
    && !orderedFolders.some(folder => folder.id === state.folderId)
  ) {
    state.folderId = orderedFolders[0]?.id
  }

  await getSnippets()

  if (
    state.snippetId !== undefined
    && !displayedSnippets.value?.some(snippet => snippet.id === state.snippetId)
  ) {
    selectFirstSnippet()
  }
}
