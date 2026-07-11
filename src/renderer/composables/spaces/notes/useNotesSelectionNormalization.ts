import { useNoteFolders } from './useNoteFolders'
import { useNotes } from './useNotes'
import { useNotesApp } from './useNotesApp'
import { useNoteSearch } from './useNoteSearch'
import { useNoteTags } from './useNoteTags'

interface FolderNode {
  id: number
  children?: FolderNode[]
}

const { folders } = useNoteFolders()
const { getNotes, refreshSelectedNote, selectFirstNote } = useNotes()
const { notesState } = useNotesApp()
const { displayedNotes } = useNoteSearch()
const { tags } = useNoteTags()

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

export async function normalizeNotesSelectionState() {
  const orderedFolders = flattenFolderTree(folders.value)

  // Папки и теги приходят из state даже в provisional-кэше: оба списка
  // пусты одновременно только пока сам state ещё offloaded — в этом окне
  // сохранённый выбор не трогаем. Если хоть один список непуст, данные
  // реально загружены, и мёртвые ссылки (тег/папка удалены на другом
  // устройстве) сбрасываются — иначе фильтр по ним навсегда прятал бы
  // записи.
  const hasLoadedTaxonomy = tags.value.length > 0 || orderedFolders.length > 0

  if (
    notesState.tagId
    && hasLoadedTaxonomy
    && !tags.value.some(tag => tag.id === notesState.tagId)
  ) {
    notesState.tagId = undefined
  }

  if (
    notesState.folderId
    && hasLoadedTaxonomy
    && !orderedFolders.some(folder => folder.id === notesState.folderId)
  ) {
    notesState.folderId = orderedFolders[0]?.id
  }

  await getNotes()

  // Пустой список — это либо реально пустой vault, либо provisional-кэш
  // периода фоновой сверки: сохранённый выбор не сбрасывается (иначе он
  // затёрся бы в store.app и после reconcile не восстановился).
  if (
    notesState.noteId !== undefined
    && displayedNotes.value?.length
    && !displayedNotes.value.some(note => note.id === notesState.noteId)
  ) {
    selectFirstNote()
  }

  // Список содержит только метаданные: полная запись выбранной заметки
  // загружается отдельно (boot и refresh после внешнего sync).
  await refreshSelectedNote()
}
