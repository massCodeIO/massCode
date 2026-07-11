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
  // Пустые списки — это либо реально пустой vault, либо provisional-кэш
  // периода фоновой сверки (state-файл сам может быть offloaded):
  // сохранённый выбор не сбрасывается, пока данные не приедут.
  if (
    notesState.tagId
    && tags.value.length
    && !tags.value.some(tag => tag.id === notesState.tagId)
  ) {
    notesState.tagId = undefined
  }

  const orderedFolders = flattenFolderTree(folders.value)

  if (
    notesState.folderId
    && orderedFolders.length
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
