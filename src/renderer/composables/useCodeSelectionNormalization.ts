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
const {
  displayedSnippets,
  getSnippets,
  refreshSelectedSnippet,
  selectFirstSnippet,
} = useSnippets()
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
  // Пустые списки — это либо реально пустой vault, либо provisional-кэш
  // периода фоновой сверки (state.json сам может быть offloaded):
  // сохранённый выбор не сбрасывается, пока данные не приедут.
  if (
    state.tagId
    && tags.value.length
    && !tags.value.some(tag => tag.id === state.tagId)
  ) {
    state.tagId = undefined
  }

  const orderedFolders = flattenFolderTree(folders.value)

  if (
    state.folderId
    && orderedFolders.length
    && !orderedFolders.some(folder => folder.id === state.folderId)
  ) {
    state.folderId = orderedFolders[0]?.id
  }

  await getSnippets()

  // Пустой список — это либо реально пустой vault, либо provisional-кэш
  // периода фоновой сверки: сохранённый выбор не сбрасывается (иначе он
  // затёрся бы в store.app и после reconcile не восстановился).
  if (
    state.snippetId !== undefined
    && displayedSnippets.value?.length
    && !displayedSnippets.value.some(snippet => snippet.id === state.snippetId)
  ) {
    selectFirstSnippet()
  }

  // Список содержит только метаданные: полная запись выбранного сниппета
  // загружается отдельно (boot и refresh после внешнего sync).
  await refreshSelectedSnippet()
}
