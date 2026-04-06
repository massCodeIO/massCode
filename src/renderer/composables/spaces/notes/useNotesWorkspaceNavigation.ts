import { LibraryFilter } from '@/composables/types'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import { useNotes } from './useNotes'
import { useNotesApp } from './useNotesApp'
import { useNoteSearch } from './useNoteSearch'

const { clearSearch } = useNoteSearch()
const { getNotes, selectFirstNote, selectNote } = useNotes()
const { notesState } = useNotesApp()

export function useNotesWorkspaceNavigation() {
  async function openNoteInNotesWorkspace(noteId: number) {
    const { data: note } = await api.notes.getNotesById(String(noteId))

    await router.push({ name: RouterName.notesSpace })
    clearSearch()
    notesState.tagId = undefined

    if (note.folder) {
      notesState.folderId = note.folder.id
      notesState.libraryFilter = undefined
      await getNotes({ folderId: note.folder.id })
    }
    else {
      notesState.folderId = undefined
      notesState.libraryFilter = LibraryFilter.Inbox
      await getNotes({ isInbox: 1 })
    }

    selectNote(noteId)
  }

  async function openTagInNotesWorkspace(tagId: number) {
    await router.push({ name: RouterName.notesSpace })
    clearSearch()
    notesState.folderId = undefined
    notesState.libraryFilter = undefined
    notesState.tagId = tagId

    await getNotes({ tagId })
    selectFirstNote()
  }

  return {
    openNoteInNotesWorkspace,
    openTagInNotesWorkspace,
  }
}
