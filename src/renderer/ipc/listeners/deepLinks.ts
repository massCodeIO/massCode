import type { DrawingItem } from '@/composables/spaces/drawings/useDrawings'
import type { NavigationHistoryEntry } from '@/composables/useNavigationHistory'
import type { SpaceId } from '@/spaceDefinitions'
import {
  initCodeSpace,
  queueNavigationUIStateRestore,
  useApp,
  useDrawings,
  useFolders,
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
  useHttpSpaceInit,
  useNavigationHistory,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteSearch,
  useNotesSpaceInitialization,
  useSnippets,
  useSonner,
} from '@/composables'
import { httpRuntimeNavigation } from '@/composables/spaces/http/runtimeNavigation'
import { LibraryFilter } from '@/composables/types'
import { i18n, ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import { getSpaceDefinitions } from '@/spaceDefinitions'

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
  httpState,
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
const { clearSearch: clearNoteSearch } = useNoteSearch()
const { restoreHistory, isNavigatingHistory, recordNavigation }
  = useNavigationHistory()

class MissingNavigationTarget extends Error {}

async function readNavigationEntity<T extends { isDeleted?: number }>(
  read: () => Promise<{ data: T }>,
  history: boolean,
): Promise<T> {
  try {
    const { data } = await read()
    if (history && data.isDeleted)
      throw new MissingNavigationTarget()
    return data
  }
  catch (error) {
    if (
      history
      && error instanceof Object
      && 'response' in error
      && (error.response as { status?: number })?.status === 404
    ) {
      throw new MissingNavigationTarget()
    }
    throw error
  }
}

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
  history = false,
): Promise<void> {
  clearCodeNavigationState()
  pendingCodeNavigation.value = true
  isAppLoading.value = true

  if (!history)
    await ensureCodeRoute()

  try {
    const snippet = await readNavigationEntity(
      () => api.snippets.getSnippetsById(String(snippetId)),
      history,
    )

    await getFolders(false)
    if (snippet.folder?.id) {
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

    if (history)
      await ensureCodeRoute()
    selectSnippet(snippetId)
    isCodeSpaceInitialized.value = true
  }
  catch (error) {
    if (history)
      throw error
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

export async function openNoteDeepLink(
  noteId: number,
  history = false,
): Promise<void> {
  clearNotesNavigationState()
  const isEnteringNotesSpace
    = router.currentRoute.value.name !== RouterName.notesSpace

  if (isEnteringNotesSpace) {
    pendingNotesNavigation.value = true
    if (!history)
      clearNotesState()
  }

  try {
    await withNotesLoading(async () => {
      if (!history)
        await ensureNotesRoute()

      const note = await readNavigationEntity(
        () => api.notes.getNotesById(String(noteId)),
        history,
      )

      clearNoteSearch()

      await getNoteFolders()
      if (note.folder?.id) {
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

      if (history)
        await ensureNotesRoute()
      selectNote(noteId)
      isNotesSpaceInitialized.value = true
    })
  }
  catch (error) {
    if (history)
      throw error
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
  history = false,
  current: () => boolean = () => true,
): Promise<boolean> {
  if (
    !current()
    || (!history && !(await httpRuntimeNavigation.confirmLeave()))
    || !current()
  ) {
    return false
  }
  const previousState = {
    activePanel: httpState.activePanel,
    folderId: httpState.folderId,
    libraryFilter: httpState.libraryFilter,
    requestId: httpState.requestId,
  }
  let restored = false
  clearHttpNavigationState()

  try {
    // Finish restoring the previous selection before mounting the HTTP space:
    // its initialization must not race with the explicit link target.
    await initHttpSpace()
    if (!current())
      return false
    if (!history)
      await ensureHttpRoute()
    if (!current())
      return false
    const request = await readNavigationEntity(
      () => api.httpRequests.getHttpRequestsById(String(requestId)),
      history,
    )

    if (!current())
      return false
    if (request.folderId !== null) {
      await getHttpFolders()
      if (!current())
        return false
      await selectHttpFolder(request.folderId)
      if (!current())
        return false
      httpState.libraryFilter = undefined
      await getHttpRequests({
        folderId: request.folderId,
        isDeleted: request.isDeleted,
      })
    }
    else {
      clearHttpFolderSelection()
      httpState.libraryFilter = request.isDeleted
        ? LibraryFilter.Trash
        : LibraryFilter.Inbox
      await getHttpRequests(
        request.isDeleted ? { isDeleted: 1 } : { isInbox: 1 },
      )
    }

    if (!current())
      return false
    if (history) {
      await selectHttpRequest(requestId, false, {
        preservePanel: true,
        current,
      })
    }
    else {
      await selectHttpRequest(requestId, false, { current })
    }
    if (!current())
      return false
    if (history) {
      if (useHttpRequests().currentRequest.value?.id !== requestId)
        return false
      await ensureHttpRoute()
      if (router.currentRoute.value.name !== RouterName.httpSpace)
        return false
      httpState.activePanel = 'request'
    }
    if (
      !current()
      || useHttpRequests().currentRequest.value?.id !== requestId
      || router.currentRoute.value.name !== RouterName.httpSpace
    ) {
      return false
    }
    restored = true
    isHttpSpaceInitialized.value = true
    return true
  }
  catch (error) {
    if (history)
      throw error
    console.error('Failed to open HTTP request deep link:', error)
    await initHttpSpace()
    return false
  }
  finally {
    if (history && !restored)
      Object.assign(httpState, previousState)
  }
}

export async function openDrawingDeepLink(drawingId: string): Promise<void> {
  const { openDrawing } = useDrawings()
  await openDrawing(drawingId)
}

export async function openDrawingTarget(drawingId: string): Promise<void> {
  await recordNavigation(async () => {
    await openDrawingDeepLink(drawingId)
  })
}

export async function openInternalTarget(
  target: InternalTarget,
): Promise<void> {
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

export async function openSpaceTarget(spaceId: SpaceId): Promise<void> {
  if (isNavigatingHistory.value)
    return
  const space = getSpaceDefinitions().find(item => item.id === spaceId)
  if (!space)
    return
  const navigate = async () => {
    if (!(await httpRuntimeNavigation.confirmLeave()))
      return false
    if (spaceId === 'code' && !isCodeSpaceInitialized.value)
      await initCodeSpace()
    else if (spaceId === 'notes')
      await initNotesSpace()
    else if (spaceId === 'http')
      await initHttpSpace()
    return !(await router.push(space.to))
  }
  await recordNavigation(async () => {
    const opened = await navigate()
    return spaceId === 'tools' || spaceId === 'math' ? false : opened
  })
}

async function restoreNavigationTarget(
  target: NavigationHistoryEntry,
): Promise<'restored' | 'missing' | 'cancelled'> {
  // Validate before changing routes or selections. Only a definite absence
  // removes an entry; offline/cloud and other transient failures keep it.
  if (target.type === 'http-folder') {
    await getHttpFolders()
    const { folders, getFolderByIdFromTree } = useHttpFolders()
    if (!getFolderByIdFromTree(folders.value, target.id))
      return 'missing'
  }
  else if (target.type === 'drawing') {
    const drawings: DrawingItem[] = await ipc.invoke(
      'spaces:drawings:list',
      null,
    )
    if (!drawings.some(drawing => drawing.id === target.id))
      return 'missing'
  }

  if (target.type === 'route') {
    if (await router.push({ name: target.routeName }))
      return 'cancelled'
  }
  else if (target.type === 'http-folder') {
    await initHttpSpace()
    await ensureHttpRoute()
    await selectHttpFolder(target.id)
    httpState.activePanel = 'folder'
  }
  else if (target.type === 'snippet') {
    await openSnippetDeepLink(target.id, undefined, true)
    if (
      useSnippets().selectedSnippet.value?.id !== target.id
      || router.currentRoute.value.name !== RouterName.main
    ) {
      return 'cancelled'
    }
  }
  else if (target.type === 'http-request') {
    await openHttpRequestDeepLink(target.id, true)
    if (
      useHttpRequests().currentRequest.value?.id !== target.id
      || router.currentRoute.value.name !== RouterName.httpSpace
    ) {
      return 'cancelled'
    }
  }
  else if (target.type === 'drawing') {
    await openDrawingDeepLink(target.id)
    if (useDrawings().activeDrawing.value?.id !== target.id)
      return 'cancelled'
  }
  else {
    await openNoteDeepLink(target.id, true)
    if (
      useNotes().selectedNote.value?.id !== target.id
      || router.currentRoute.value.name !== RouterName.notesSpace
    ) {
      return 'cancelled'
    }
  }
  queueNavigationUIStateRestore(target)
  return 'restored'
}

async function navigateHistory(direction: -1 | 1): Promise<void> {
  let confirmed = false
  await restoreHistory(direction, async (target) => {
    if (!confirmed) {
      if (!(await httpRuntimeNavigation.confirmLeave()))
        return 'cancelled'
      confirmed = true
    }
    try {
      return await restoreNavigationTarget(target)
    }
    catch (error) {
      if (error instanceof MissingNavigationTarget)
        return 'missing'
      console.error('Failed to restore navigation history:', error)
      return 'cancelled'
    }
  })
}

export async function navigateBack(): Promise<void> {
  await navigateHistory(-1)
}

export async function navigateForward(): Promise<void> {
  await navigateHistory(1)
}

async function activateLicenseFromDeepLink(key: string): Promise<void> {
  const { sonner } = useSonner()
  const { isSponsored } = useApp()

  const result = (await ipc.invoke('system:activate-license', { key })) as {
    active: boolean
    name: string | null
  }

  if (!result.active) {
    sonner({
      message: i18n.t('messages:error.licenseInvalid'),
      type: 'error',
    })
    return
  }

  isSponsored.value = true

  sonner({
    message: i18n.t('messages:success.licenseActivated'),
    type: 'success',
  })
}

export async function handleDeepLink(url: string): Promise<void> {
  const parsed = new URL(url)

  if (parsed.hostname === 'activate') {
    const key = parsed.searchParams.get('key')

    if (key) {
      await activateLicenseFromDeepLink(key)
    }

    return
  }

  if (parsed.hostname === 'drawing') {
    const drawingId = decodeURIComponent(
      parsed.pathname.replace(/^\/+/, ''),
    ).trim()

    if (drawingId) {
      await openDrawingTarget(drawingId)
    }

    return
  }

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
