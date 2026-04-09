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
const { getNotes, selectFirstNote } = useNotes()
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
  if (
    notesState.tagId
    && !tags.value.some(tag => tag.id === notesState.tagId)
  ) {
    notesState.tagId = undefined
  }

  const orderedFolders = flattenFolderTree(folders.value)

  if (
    notesState.folderId
    && !orderedFolders.some(folder => folder.id === notesState.folderId)
  ) {
    notesState.folderId = orderedFolders[0]?.id
  }

  await getNotes()

  if (
    notesState.noteId !== undefined
    && !displayedNotes.value?.some(note => note.id === notesState.noteId)
  ) {
    selectFirstNote()
  }
}
