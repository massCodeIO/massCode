import type { NativeBridgeResult } from './nativeBridges'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import { httpRuntimeNavigation } from '@/composables/spaces/http/runtimeNavigation'
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpFolders } from '@/composables/spaces/http/useHttpFolders'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpSearch } from '@/composables/spaces/http/useHttpSearch'
import { useHttpWorkspaceNavigation } from '@/composables/spaces/http/useHttpWorkspaceNavigation'
import { useNoteFolders } from '@/composables/spaces/notes/useNoteFolders'
import { useNotes } from '@/composables/spaces/notes/useNotes'
import { useNotesApp } from '@/composables/spaces/notes/useNotesApp'
import { useNoteSearch } from '@/composables/spaces/notes/useNoteSearch'
import { useNotesWorkspaceNavigation } from '@/composables/spaces/notes/useNotesWorkspaceNavigation'
import { useNoteTags } from '@/composables/spaces/notes/useNoteTags'
import { useApp } from '@/composables/useApp'
import { useFolders } from '@/composables/useFolders'
import { useSnippets } from '@/composables/useSnippets'
import { useTags } from '@/composables/useTags'
import { router, RouterName } from '@/router'

type Action = Extract<
  AiNativeAction,
  { action: 'listQuery' | 'listSelection' }
>

export async function executeNativeList(
  action: Action,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  if (!current())
    return { status: 'stale' }
  const code = useSnippets()
  const notes = useNotes()
  const http = useHttpRequests()
  const search
    = action.space === 'code'
      ? code
      : action.space === 'notes'
        ? useNoteSearch()
        : useHttpSearch()
  const state
    = action.space === 'code'
      ? useApp().state
      : action.space === 'notes'
        ? useNotesApp().notesState
        : useHttpApp().httpState
  const selected
    = action.space === 'code'
      ? code.selectedSnippetIds
      : action.space === 'notes'
        ? notes.selectedNoteIds
        : http.selectedRequestIds
  const displayed = () =>
    action.space === 'code'
      ? code.displayedSnippets.value
      : action.space === 'notes'
        ? useNoteSearch().displayedNotes.value
        : useHttpSearch().displayedRequests.value
  const load = () =>
    action.space === 'code'
      ? code.getSnippets()
      : action.space === 'notes'
        ? notes.getNotes()
        : http.getHttpRequests()
  const selectFirst = () =>
    action.space === 'code'
      ? code.selectFirstSnippet()
      : action.space === 'notes'
        ? notes.selectFirstNote()
        : http.selectFirstRequest({ current })
  const route
    = action.space === 'code'
      ? RouterName.main
      : action.space === 'notes'
        ? RouterName.notesSpace
        : RouterName.httpSpace
  const receipt = (): NativeBridgeResult => ({
    status: current() ? 'done' : 'stale',
    list: {
      query: search.searchQuery.value,
      scope: state.folderId
        ? { kind: 'folder', id: state.folderId }
        : 'tagId' in state && state.tagId
          ? { kind: 'tag', id: state.tagId }
          : state.libraryFilter
            ? { kind: 'library', filter: state.libraryFilter }
            : { kind: 'clear' },
      count: displayed()?.length ?? 0,
      selectedIds: [...selected.value],
    },
  })
  if (action.action === 'listSelection') {
    const valid = () =>
      new Set(action.ids).size === action.ids.length
        && action.ids.every(id => displayed()?.some(item => item.id === id))
    if (!valid())
      return { status: 'unavailable' }
    await router.push({ name: route })
    if (!current() || router.currentRoute.value.name !== route || !valid())
      return { status: 'stale' }
    const first = action.ids[0]
    if (action.space === 'http') {
      if (!(await http.selectHttpRequest(first, false, { current })))
        return { status: current() ? 'cancelled' : 'stale' }
      if (!current() || !valid())
        return { status: 'stale' }
      if (
        useHttpApp().httpState.requestId !== first
        || (first !== undefined && http.currentRequest.value?.id !== first)
      ) {
        return { status: 'cancelled' }
      }
      http.lastSelectedRequestId.value = action.ids.at(-1)
    }
    else if (action.space === 'code') {
      if (first !== undefined)
        code.selectSnippet(first)
      else useApp().state.snippetId = undefined
      code.lastSelectedSnippetId.value = action.ids.at(-1)
    }
    else {
      if (first !== undefined)
        notes.selectNote(first)
      else useNotesApp().notesState.noteId = undefined
      notes.lastSelectedNoteId.value = action.ids.at(-1)
    }
    selected.value = [...action.ids]
    return receipt()
  }
  const scope = action.scope
  if (scope?.kind === 'tag' && action.space === 'http')
    return { status: 'unavailable' }
  if (
    scope?.kind === 'library'
    && action.space !== 'notes'
    && ['tasks', 'today', 'upcoming', 'completed'].includes(scope.filter)
  ) {
    return { status: 'unavailable' }
  }
  if (scope?.kind === 'tag') {
    const tags
      = action.space === 'code' ? useTags().tags.value : useNoteTags().tags.value
    if (!tags?.some(tag => tag.id === scope.id))
      return { status: 'unavailable' }
  }
  if (scope?.kind === 'folder') {
    const folders
      = action.space === 'code'
        ? useFolders()
        : action.space === 'notes'
          ? useNoteFolders()
          : useHttpFolders()
    if (!folders.getFolderByIdFromTree(folders.folders.value ?? [], scope.id))
      return { status: 'unavailable' }
  }
  if (action.space === 'http') {
    const token = ++httpRuntimeNavigation.transitionToken
    if (!(await httpRuntimeNavigation.confirmLeave()))
      return { status: 'cancelled' }
    if (token !== httpRuntimeNavigation.transitionToken)
      return { status: 'stale' }
  }
  if (!current())
    return { status: 'stale' }
  await router.push({ name: route })
  if (!current() || router.currentRoute.value.name !== route)
    return { status: 'stale' }
  if (scope?.kind === 'clear') {
    if ((await search.clearSearch(true)) === false)
      return { status: 'cancelled' }
  }
  else if (scope) {
    await search.clearSearch()
    if (!current())
      return { status: 'stale' }
    if (scope.kind === 'folder') {
      if (action.space === 'http') {
        if (!(await useHttpFolders().openHttpFolder(scope.id, current)))
          return { status: 'cancelled' }
      }
      else if (action.space === 'code') {
        await useFolders().selectFolder(scope.id)
      }
      else {
        await useNoteFolders().selectNoteFolder(scope.id)
      }
    }
    else if (action.space === 'http' && scope.kind === 'library') {
      if (
        !(await useHttpWorkspaceNavigation().openHttpLibrary(
          scope.filter as 'all' | 'inbox' | 'favorites' | 'trash',
          current,
        ))
      ) {
        return { status: 'cancelled' }
      }
    }
    else if (action.space === 'notes' && scope.kind === 'tag') {
      if (
        !(await useNotesWorkspaceNavigation().openTagInNotesWorkspace(
          scope.id,
          current,
        ))
      ) {
        return { status: 'failed' }
      }
    }
    else if (action.space === 'notes' && scope.kind === 'library') {
      if (
        !(await useNotesWorkspaceNavigation().openNotesLibrary(
          scope.filter,
          current,
        ))
      ) {
        return { status: 'failed' }
      }
    }
    else {
      if (action.space === 'code')
        useFolders().clearFolderSelection()
      else useNoteFolders().clearFolderSelection()
      state.libraryFilter = scope.kind === 'library' ? scope.filter : undefined
      if (action.space === 'code') {
        useApp().state.tagId = scope.kind === 'tag' ? scope.id : undefined
      }
      else {
        useNotesApp().notesState.tagId
          = scope.kind === 'tag' ? scope.id : undefined
      }
    }
  }
  if (!current())
    return { status: 'stale' }
  if (action.query !== undefined)
    search.searchQuery.value = action.query
  if (search.searchQuery.value) {
    if (!(await search.search(current)))
      return { status: 'failed' }
  }
  else {
    await search.clearSearch()
    if (!current())
      return { status: 'stale' }
    const loaded = await load()
    if (!current())
      return { status: 'stale' }
    if (!loaded)
      return { status: 'failed' }
    if (scope?.kind === 'clear' && action.space !== 'http') {
      const restored
        = action.space === 'code'
          ? useApp().state.snippetId
          : useNotesApp().notesState.noteId
      const primary = displayed()?.some(item => item.id === restored)
        ? restored
        : undefined
      selected.value = primary === undefined ? [] : [primary]
      if (action.space === 'code') {
        useApp().state.snippetId = primary
        code.lastSelectedSnippetId.value = primary
      }
      else {
        useNotesApp().notesState.noteId = primary
        notes.lastSelectedNoteId.value = primary
      }
    }
    if (scope?.kind !== 'clear' && (await selectFirst()) === false)
      return { status: 'cancelled' }
  }
  return receipt()
}
