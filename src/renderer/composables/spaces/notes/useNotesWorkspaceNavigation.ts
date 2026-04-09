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
  async function openNoteInNotesWorkspaceInternal(noteId: number) {
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

  async function openNoteWithOptionalRouteHistory(noteId: number) {
    const routeName = router.currentRoute.value.name
    const shouldRecordRouteHistory
      = routeName === RouterName.notesDashboard
        || routeName === RouterName.notesGraph

    if (!shouldRecordRouteHistory) {
      await openNoteInNotesWorkspaceInternal(noteId)
      return
    }

    const { useNavigationHistory } = await import(
      '@/composables/useNavigationHistory'
    )
    const { isNavigatingHistory, recordNavigation } = useNavigationHistory()

    if (isNavigatingHistory.value) {
      await openNoteInNotesWorkspaceInternal(noteId)
      return
    }

    await recordNavigation(async () => {
      await openNoteInNotesWorkspaceInternal(noteId)
    })
  }

  async function openNoteInNotesWorkspace(noteId: number) {
    await openNoteWithOptionalRouteHistory(noteId)
  }

  async function openNoteFromGraph(noteId: number) {
    await openNoteWithOptionalRouteHistory(noteId)
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
    openNoteFromGraph,
    openNoteInNotesWorkspace,
    openTagInNotesWorkspace,
  }
}
