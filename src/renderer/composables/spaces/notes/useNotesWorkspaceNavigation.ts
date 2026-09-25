import { LibraryFilter } from '@/composables/types'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import { useNoteFolders } from './useNoteFolders'
import { useNotes } from './useNotes'
import { useNotesApp } from './useNotesApp'
import { useNoteSearch } from './useNoteSearch'

const { clearSearch } = useNoteSearch()
const { getNotes, selectFirstNote, selectNote } = useNotes()
const { notesState } = useNotesApp()

export function useNotesWorkspaceNavigation() {
  async function openNotesLibrary(
    id: (typeof LibraryFilter)[keyof typeof LibraryFilter],
    current: () => boolean = () => true,
  ) {
    if (!current())
      return false
    if (router.currentRoute.value.name !== RouterName.notesSpace)
      await router.push({ name: RouterName.notesSpace })
    if (!current() || router.currentRoute.value.name !== RouterName.notesSpace)
      return false
    const { notesState } = useNotesApp()
    const {
      getNotes,
      selectFirstNote,
      withNotesLoading,
      isRestoreStateBlocked,
    } = useNotes()
    return withNotesLoading(async () => {
      isRestoreStateBlocked.value = true
      useNoteSearch().clearSearch()
      notesState.libraryFilter = id
      useNoteFolders().clearFolderSelection()
      notesState.tagId = undefined
      let loaded = false
      if (id === LibraryFilter.Favorites) {
        loaded = await getNotes({ isFavorites: 1 })
      }
      else if (id === LibraryFilter.Trash) {
        loaded = await getNotes({ isDeleted: 1 })
      }
      else if (id === LibraryFilter.All) {
        loaded = await getNotes({ isDeleted: 0 })
      }
      else if (id === LibraryFilter.Inbox) {
        loaded = await getNotes({ isInbox: 1 })
      }
      else if (id === LibraryFilter.Tasks) {
        loaded = await getNotes({ propertyType: 'task' })
      }
      else if (id === LibraryFilter.Today) {
        loaded = await getNotes({
          propertyDue: 'today',
          propertyStatusNot: 'done',
          propertyType: 'task',
        })
      }
      else if (id === LibraryFilter.Upcoming) {
        loaded = await getNotes({
          propertyDue: 'upcoming',
          propertyStatusNot: 'done',
          propertyType: 'task',
        })
      }
      else if (id === LibraryFilter.Completed) {
        loaded = await getNotes({
          propertyStatus: 'done',
          propertyType: 'task',
        })
      }

      if (
        !loaded
        || !current()
        || router.currentRoute.value.name !== RouterName.notesSpace
        || notesState.libraryFilter !== id
      ) {
        return false
      }
      selectFirstNote()
      return true
    })
  }

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
    const { useNavigationHistory } = await import(
      '@/composables/useNavigationHistory'
    )
    const { recordNavigation } = useNavigationHistory()

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

  async function openTagInNotesWorkspace(
    tagId: number,
    current: () => boolean = () => true,
  ) {
    await router.push({ name: RouterName.notesSpace })
    clearSearch()
    if (!current() || router.currentRoute.value.name !== RouterName.notesSpace)
      return false
    useNoteFolders().clearFolderSelection()
    notesState.libraryFilter = undefined
    notesState.tagId = tagId

    if (
      !(await getNotes({ tagId }))
      || !current()
      || notesState.tagId !== tagId
    ) {
      return false
    }
    selectFirstNote()
    return true
  }

  return {
    openNotesLibrary,
    openNoteFromGraph,
    openNoteInNotesWorkspace,
    openTagInNotesWorkspace,
  }
}
