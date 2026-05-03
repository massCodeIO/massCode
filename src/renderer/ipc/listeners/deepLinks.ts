import type { NavigationHistoryEntry } from '@/composables/useNavigationHistory'
import {
  initCodeSpace,
  queueNavigationUIStateRestore,
  useApp,
  useFolders,
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
  useHttpSpaceInit,
  useNavigationHistory,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNotesSpaceInitialization,
  useSnippets,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'

interface InternalTarget {
  type: 'snippet' | 'note' | 'http-request'
  id: number
}

const {
  focusedFolderId,
  focusedSnippetId,
  highlightedFolderIds,
  highlightedSnippetIds,
  isAppLoading,
  isCodeSpaceInitialized,
  pendingCodeNavigation,
  state,
} = useApp()
const {
  focusedNoteId,
  highlightedFolderIds: highlightedNoteFolderIds,
  highlightedNoteIds,
  isNotesSpaceInitialized,
  notesState,
  pendingNotesNavigation,
} = useNotesApp()
const {
  focusedRequestId,
  highlightedFolderIds: highlightedHttpFolderIds,
  highlightedRequestIds,
  isHttpSpaceInitialized,
} = useHttpApp()

const { clearFolderSelection, getFolders, selectFolder } = useFolders()
const { getSnippets, selectSnippet } = useSnippets()
const {
  clearFolderSelection: clearHttpFolderSelection,
  getHttpFolders,
  selectHttpFolder,
} = useHttpFolders()
const { getHttpRequests, selectHttpRequest } = useHttpRequests()
const { initHttpSpace } = useHttpSpaceInit()
const {
  clearFolderSelection: clearNoteFolderSelection,
  getNoteFolders,
  selectNoteFolder,
} = useNoteFolders()
const { clearNotesState, getNotes, selectNote, withNotesLoading } = useNotes()
const { initNotesSpace } = useNotesSpaceInitialization()
const { goBack, goForward, isNavigatingHistory, recordNavigation }
  = useNavigationHistory()

function clearCodeNavigationState() {
  highlightedFolderIds.value.clear()
  highlightedSnippetIds.value.clear()
  focusedSnippetId.value = undefined
  focusedFolderId.value = undefined
}

function clearNotesNavigationState() {
  highlightedNoteFolderIds.value.clear()
  highlightedNoteIds.value.clear()
  focusedNoteId.value = undefined
}

function clearHttpNavigationState() {
  highlightedHttpFolderIds.value.clear()
  highlightedRequestIds.value.clear()
  focusedRequestId.value = undefined
}

async function ensureCodeRoute() {
  if (router.currentRoute.value.name !== RouterName.main) {
    await router.push({ name: RouterName.main })
  }
}

async function ensureNotesRoute() {
  if (router.currentRoute.value.name !== RouterName.notesSpace) {
    await router.push({ name: RouterName.notesSpace })
  }
}

async function ensureHttpRoute() {
  if (router.currentRoute.value.name !== RouterName.httpSpace) {
    await router.push({ name: RouterName.httpSpace })
  }
}

export async function openSnippetDeepLink(
  snippetId: number,
  legacyFolderId?: number,
): Promise<void> {
  clearCodeNavigationState()
  pendingCodeNavigation.value = true
  isAppLoading.value = true

  await ensureCodeRoute()

  try {
    const { data: snippet } = await api.snippets.getSnippetsById(
      String(snippetId),
    )

    if (snippet.folder?.id) {
      await getFolders(false)
      await selectFolder(snippet.folder.id)
      await getSnippets({ folderId: snippet.folder.id })
    }
    else {
      clearFolderSelection()
      state.tagId = undefined
      state.libraryFilter = snippet.isDeleted
        ? LibraryFilter.Trash
        : LibraryFilter.Inbox

      await getSnippets(snippet.isDeleted ? { isDeleted: 1 } : { isInbox: 1 })
    }

    selectSnippet(snippetId)
    isCodeSpaceInitialized.value = true
  }
  catch (error) {
    if (legacyFolderId) {
      await getFolders(false)
      await selectFolder(legacyFolderId)
      await getSnippets({ folderId: legacyFolderId })
      selectSnippet(snippetId)
      isCodeSpaceInitialized.value = true
    }
    else {
      console.error('Failed to open snippet deep link:', error)
      await initCodeSpace()
    }
  }
  finally {
    pendingCodeNavigation.value = false
    isAppLoading.value = false
  }
}

export async function openNoteDeepLink(noteId: number): Promise<void> {
  clearNotesNavigationState()
  const isEnteringNotesSpace
    = router.currentRoute.value.name !== RouterName.notesSpace

  if (isEnteringNotesSpace) {
    pendingNotesNavigation.value = true
    clearNotesState()
  }

  try {
    await withNotesLoading(async () => {
      await ensureNotesRoute()

      const { data: note } = await api.notes.getNotesById(String(noteId))

      if (note.folder?.id) {
        await getNoteFolders()
        await selectNoteFolder(note.folder.id)
        await getNotes({ folderId: note.folder.id })
      }
      else {
        clearNoteFolderSelection()
        notesState.tagId = undefined
        notesState.libraryFilter = note.isDeleted
          ? LibraryFilter.Trash
          : LibraryFilter.Inbox

        await getNotes(note.isDeleted ? { isDeleted: 1 } : { isInbox: 1 })
      }

      selectNote(noteId)
      isNotesSpaceInitialized.value = true
    })
  }
  catch (error) {
    console.error('Failed to open note deep link:', error)

    if (isEnteringNotesSpace) {
      await initNotesSpace()
    }
  }
  finally {
    pendingNotesNavigation.value = false
  }
}

export async function openHttpRequestDeepLink(
  requestId: number,
): Promise<void> {
  clearHttpNavigationState()
  await ensureHttpRoute()

  try {
    const { data: request } = await api.httpRequests.getHttpRequestsById(
      String(requestId),
    )

    await getHttpRequests()

    if (request.folderId !== null) {
      await getHttpFolders()
      await selectHttpFolder(request.folderId)
    }
    else {
      clearHttpFolderSelection()
    }

    selectHttpRequest(requestId)
    isHttpSpaceInitialized.value = true
  }
  catch (error) {
    console.error('Failed to open HTTP request deep link:', error)
    await initHttpSpace()
  }
}

export async function openInternalTarget(
  target: InternalTarget,
): Promise<void> {
  if (isNavigatingHistory.value) {
    if (target.type === 'snippet') {
      await openSnippetDeepLink(target.id)
      return
    }

    if (target.type === 'http-request') {
      await openHttpRequestDeepLink(target.id)
      return
    }

    await openNoteDeepLink(target.id)
    return
  }

  await recordNavigation(async () => {
    if (target.type === 'snippet') {
      await openSnippetDeepLink(target.id)
      return
    }

    if (target.type === 'http-request') {
      await openHttpRequestDeepLink(target.id)
      return
    }

    await openNoteDeepLink(target.id)
  })
}

async function restoreNavigationTarget(
  target: NavigationHistoryEntry,
): Promise<void> {
  isNavigatingHistory.value = true

  try {
    queueNavigationUIStateRestore(target)

    if (target.type === 'route') {
      await router.push({ name: target.routeName })
      return
    }

    if (target.type === 'snippet') {
      await openSnippetDeepLink(target.id)
      return
    }

    if (target.type === 'http-request') {
      await openHttpRequestDeepLink(target.id)
      return
    }

    await openNoteDeepLink(target.id)
  }
  finally {
    isNavigatingHistory.value = false
  }
}

export async function navigateBack(): Promise<void> {
  const target = goBack()

  if (!target) {
    return
  }

  await restoreNavigationTarget(target)
}

export async function navigateForward(): Promise<void> {
  const target = goForward()

  if (!target) {
    return
  }

  await restoreNavigationTarget(target)
}

export async function handleDeepLink(url: string): Promise<void> {
  const parsed = new URL(url)
  const snippetId = parsed.searchParams.get('snippetId')
  const noteId = parsed.searchParams.get('noteId')
  const httpRequestId = parsed.searchParams.get('httpRequestId')
  const legacyFolderId = parsed.searchParams.get('folderId')

  if (snippetId) {
    await recordNavigation(async () => {
      await openSnippetDeepLink(
        Number(snippetId),
        legacyFolderId ? Number(legacyFolderId) : undefined,
      )
    })
    return
  }

  if (noteId) {
    await recordNavigation(async () => {
      await openNoteDeepLink(Number(noteId))
    })
    return
  }

  if (httpRequestId) {
    await recordNavigation(async () => {
      await openHttpRequestDeepLink(Number(httpRequestId))
    })
  }
}
