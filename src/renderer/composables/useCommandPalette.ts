import type {
  HttpRequestsResponse,
  NoteItemResponse,
  NotesResponse,
  SnippetItemResponse,
  SnippetsResponse,
} from '@/services/api/generated'
import type { Component } from 'vue'
import {
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
  useHttpSearch,
} from '@/composables/spaces/http'
import {
  useNotes,
  useNotesApp,
  useNoteSearch,
} from '@/composables/spaces/notes'
import { i18n, store } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import {
  getActiveSpaceId,
  getSpaceDefinitions,
  type SpaceId,
} from '@/spaceDefinitions'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { Settings } from 'lucide-vue-next'
import { LibraryFilter } from './types'

type SnippetResult = SnippetsResponse[number]
type NoteResult = NotesResponse[number]
type HttpRequestResult = HttpRequestsResponse[number]
type CommandPaletteRecentTarget = 'space' | 'snippet' | 'note' | 'http-request'

interface CommandPaletteRecentEntry {
  id: string
  target: CommandPaletteRecentTarget
  targetId: string
  title: string
  subtitle: string
  spaceId: SpaceId
  openedAt: number
}

interface CommandPaletteCommand {
  id: string
  title: string
  subtitle: string
  icon: Component
  spaceId?: SpaceId
  run: () => Promise<void>
}

interface CommandPaletteRecentResult {
  id: string
  type: 'recent'
  title: string
  subtitle: string
  icon: Component
  recent: CommandPaletteRecentEntry
}

export type CommandPaletteResult =
  | {
    id: string
    type: 'space'
    title: string
    subtitle: string
    icon: Component
    spaceId: SpaceId
  }
  | {
    id: string
    type: 'snippet'
    title: string
    subtitle: string
    icon: Component
    item: SnippetResult
  }
  | {
    id: string
    type: 'note'
    title: string
    subtitle: string
    icon: Component
    item: NoteResult
  }
  | {
    id: string
    type: 'http-request'
    title: string
    subtitle: string
    icon: Component
    item: HttpRequestResult
  }
  | {
    id: string
    type: 'command'
    title: string
    subtitle: string
    icon: Component
    command: CommandPaletteCommand
  }
  | CommandPaletteRecentResult

const isOpen = ref(false)
const query = ref('')
const isSearching = ref(false)
const snippets = shallowRef<SnippetResult[]>([])
const notes = shallowRef<NoteResult[]>([])
const httpRequests = shallowRef<HttpRequestResult[]>([])
const recentEntries = shallowRef<CommandPaletteRecentEntry[]>(
  store.app.get<CommandPaletteRecentEntry[]>('commandPalette.recent') || [],
)
let searchRunId = 0
const RECENT_LIMIT = 30
const ROOT_RECENT_LIMIT = 3

const notesApp = useNotesApp()
const notesData = useNotes()
const noteSearch = useNoteSearch()
const httpApp = useHttpApp()
const httpData = useHttpRequests()
const httpSearch = useHttpSearch()

function getResultTitle(value: string | undefined, fallback: string) {
  return value?.trim() || fallback
}

function getSpaceIcon(spaceId: SpaceId) {
  return getSpaceDefinitions().find(space => space.id === spaceId)!.icon
}

function saveRecentEntries(entries: CommandPaletteRecentEntry[]) {
  recentEntries.value = entries
  store.app.set('commandPalette.recent', JSON.parse(JSON.stringify(entries)))
}

function getRecentEntryFromResult(
  result: CommandPaletteResult,
): CommandPaletteRecentEntry | null {
  if (result.type === 'space') {
    return {
      id: `space:${result.spaceId}`,
      target: 'space',
      targetId: result.spaceId,
      title: result.title,
      subtitle: result.subtitle,
      spaceId: result.spaceId,
      openedAt: Date.now(),
    }
  }

  if (result.type === 'snippet') {
    return {
      id: `snippet:${result.item.id}`,
      target: 'snippet',
      targetId: String(result.item.id),
      title: result.title,
      subtitle: result.subtitle,
      spaceId: 'code',
      openedAt: Date.now(),
    }
  }

  if (result.type === 'note') {
    return {
      id: `note:${result.item.id}`,
      target: 'note',
      targetId: String(result.item.id),
      title: result.title,
      subtitle: result.subtitle,
      spaceId: 'notes',
      openedAt: Date.now(),
    }
  }

  if (result.type === 'http-request') {
    return {
      id: `http-request:${result.item.id}`,
      target: 'http-request',
      targetId: String(result.item.id),
      title: result.title,
      subtitle: result.subtitle,
      spaceId: 'http',
      openedAt: Date.now(),
    }
  }

  return null
}

function recordRecentResult(result: CommandPaletteResult) {
  if (result.type === 'recent') {
    const entry = {
      ...result.recent,
      openedAt: Date.now(),
    }

    saveRecentEntries(
      [
        entry,
        ...recentEntries.value.filter(item => item.id !== entry.id),
      ].slice(0, RECENT_LIMIT),
    )
    return
  }

  const entry = getRecentEntryFromResult(result)

  if (!entry) {
    return
  }

  saveRecentEntries(
    [
      entry,
      ...recentEntries.value.filter(item => item.id !== entry.id),
    ].slice(0, RECENT_LIMIT),
  )
}

const spaceResults = computed<CommandPaletteResult[]>(() =>
  getSpaceDefinitions().map(space => ({
    id: `space:${space.id}`,
    type: 'space',
    title: space.label,
    subtitle: space.tooltip,
    icon: space.icon,
    spaceId: space.id,
  })),
)

const commandResults = computed<CommandPaletteResult[]>(() => {
  const activeSpaceId = getActiveSpaceId()
  const commands = getCommandDefinitions()
  const orderedCommands = [...commands].sort((a, b) => {
    if (a.spaceId === activeSpaceId && b.spaceId !== activeSpaceId) {
      return -1
    }

    if (a.spaceId !== activeSpaceId && b.spaceId === activeSpaceId) {
      return 1
    }

    return 0
  })

  return orderedCommands.map(command => ({
    id: `command:${command.id}`,
    type: 'command',
    title: command.title,
    subtitle: command.subtitle,
    icon: command.icon,
    command,
  }))
})

const recentResults = computed<CommandPaletteResult[]>(() =>
  recentEntries.value.slice(0, ROOT_RECENT_LIMIT).map(entry => ({
    id: `recent:${entry.id}`,
    type: 'recent',
    title: entry.title,
    subtitle: entry.subtitle,
    icon: getSpaceIcon(entry.spaceId),
    recent: entry,
  })),
)

const snippetResults = computed<CommandPaletteResult[]>(() =>
  snippets.value.map(snippet => ({
    id: `snippet:${snippet.id}`,
    type: 'snippet',
    title: getResultTitle(snippet.name, i18n.t('snippet.untitled')),
    subtitle: snippet.folder?.name || i18n.t('common.library'),
    icon: getSpaceIcon('code'),
    item: snippet,
  })),
)

const noteResults = computed<CommandPaletteResult[]>(() =>
  notes.value.map(note => ({
    id: `note:${note.id}`,
    type: 'note',
    title: getResultTitle(note.name, i18n.t('notes.untitled')),
    subtitle: note.folder?.name || i18n.t('common.library'),
    icon: getSpaceIcon('notes'),
    item: note,
  })),
)

const httpRequestResults = computed<CommandPaletteResult[]>(() =>
  httpRequests.value.map(request => ({
    id: `http-request:${request.id}`,
    type: 'http-request',
    title: getResultTitle(request.name, i18n.t('spaces.http.untitledRequest')),
    subtitle: request.url || i18n.t('spaces.http.noUrl'),
    icon: getSpaceIcon('http'),
    item: request,
  })),
)

const hasQuery = computed(() => query.value.trim().length > 0)

function resetSearchResults() {
  snippets.value = []
  notes.value = []
  httpRequests.value = []
}

async function runSearch(value: string) {
  const search = value.trim()

  if (search !== query.value.trim()) {
    return
  }

  const runId = ++searchRunId

  if (!search) {
    resetSearchResults()
    isSearching.value = false
    return
  }

  isSearching.value = true

  const [snippetsResult, notesResult, httpRequestsResult]
    = await Promise.allSettled([
      api.snippets.getSnippets({ search, searchNameOnly: 1, isDeleted: 0 }),
      api.notes.getNotes({ search, searchNameOnly: 1, isDeleted: 0 }),
      api.httpRequests.getHttpRequests({ search, searchNameOnly: 1 }),
    ])

  if (runId !== searchRunId || search !== query.value.trim()) {
    return
  }

  snippets.value
    = snippetsResult.status === 'fulfilled' ? snippetsResult.value.data : []
  notes.value
    = notesResult.status === 'fulfilled' ? notesResult.value.data : []
  httpRequests.value
    = httpRequestsResult.status === 'fulfilled'
      ? httpRequestsResult.value.data
      : []
  isSearching.value = false
}

const debouncedRunSearch = useDebounceFn(runSearch, 180)

function setQuery(value: string) {
  const search = value.trim()

  searchRunId += 1
  query.value = value

  if (!search) {
    resetSearchResults()
    isSearching.value = false
    return
  }

  isSearching.value = true
  debouncedRunSearch(value)
}

function openPalette() {
  isOpen.value = true
}

function closePalette() {
  isOpen.value = false
}

function togglePalette() {
  isOpen.value = !isOpen.value
}

function clearPalette() {
  searchRunId += 1
  query.value = ''
  resetSearchResults()
  isSearching.value = false
}

async function openSpace(spaceId: SpaceId) {
  const space = getSpaceDefinitions().find(item => item.id === spaceId)
  if (space) {
    await router.push(space.to)
  }
}

async function createSnippetFromPalette() {
  const [{ useApp }, { useFolders }, { useSnippets }] = await Promise.all([
    import('@/composables/useApp'),
    import('@/composables/useFolders'),
    import('@/composables/useSnippets'),
  ])
  const codeApp = useApp()
  const codeFolders = useFolders()
  const codeSnippets = useSnippets()

  codeSnippets.isRestoreStateBlocked.value = true
  codeSnippets.clearSearch(false)
  codeFolders.clearFolderSelection()
  codeApp.state.libraryFilter = LibraryFilter.Inbox
  codeApp.state.tagId = undefined
  codeApp.focusedFolderId.value = undefined
  codeApp.highlightedFolderIds.value.clear()
  codeApp.highlightedTagId.value = undefined

  await router.push({ name: RouterName.main })
  await codeSnippets.createSnippetAndSelect()
}

async function createNoteFromPalette() {
  const { useNoteFolders } = await import('@/composables/spaces/notes')
  const noteFolders = useNoteFolders()
  const notesApi = useNotes()

  notesApi.isRestoreStateBlocked.value = true
  noteSearch.clearSearch(false)
  noteFolders.clearFolderSelection()
  notesApp.hideNotesViewModes()
  notesApp.notesState.libraryFilter = LibraryFilter.Inbox
  notesApp.notesState.tagId = undefined
  notesApp.focusedFolderId.value = undefined
  notesApp.highlightedFolderIds.value.clear()
  notesApp.highlightedTagId.value = undefined

  await router.push({ name: RouterName.notesSpace })
  await notesApi.createNoteAndSelect()
}

async function createHttpRequestFromPalette() {
  const httpFolders = useHttpFolders()
  const httpRequestsApi = useHttpRequests()

  httpRequestsApi.isRestoreStateBlocked.value = true
  httpSearch.clearSearch(false)
  httpFolders.clearFolderSelection()
  httpApp.focusedFolderId.value = undefined
  httpApp.highlightedFolderIds.value.clear()

  await router.push({ name: RouterName.httpSpace })
  await httpRequestsApi.createHttpRequestAndSelect({ folderId: null })
}

async function openPreferencesFromPalette() {
  await router.push({ name: RouterName.preferences })
}

function getCommandDefinitions(): CommandPaletteCommand[] {
  return [
    {
      id: 'new-snippet',
      title: i18n.t('commandPalette.actions.newSnippet'),
      subtitle: i18n.t('commandPalette.actions.newSnippetSubtitle'),
      icon: getSpaceIcon('code'),
      spaceId: 'code',
      run: createSnippetFromPalette,
    },
    {
      id: 'new-note',
      title: i18n.t('commandPalette.actions.newNote'),
      subtitle: i18n.t('commandPalette.actions.newNoteSubtitle'),
      icon: getSpaceIcon('notes'),
      spaceId: 'notes',
      run: createNoteFromPalette,
    },
    {
      id: 'new-http-request',
      title: i18n.t('commandPalette.actions.newHttpRequest'),
      subtitle: i18n.t('commandPalette.actions.newHttpRequestSubtitle'),
      icon: getSpaceIcon('http'),
      spaceId: 'http',
      run: createHttpRequestFromPalette,
    },
    {
      id: 'open-preferences',
      title: i18n.t('commandPalette.actions.openPreferences'),
      subtitle: i18n.t('commandPalette.actions.openPreferencesSubtitle'),
      icon: Settings,
      run: openPreferencesFromPalette,
    },
  ]
}

async function openSnippet(snippet: SnippetResult) {
  const [{ useApp }, { useFolders }, { useSnippets }] = await Promise.all([
    import('@/composables/useApp'),
    import('@/composables/useFolders'),
    import('@/composables/useSnippets'),
  ])
  const codeApp = useApp()
  const codeFolders = useFolders()
  const codeSnippets = useSnippets()

  codeSnippets.isRestoreStateBlocked.value = true
  codeSnippets.clearSearch(false)
  codeApp.state.tagId = undefined
  codeApp.state.snippetContentIndex = 0
  codeApp.focusedFolderId.value = undefined
  codeApp.highlightedFolderIds.value.clear()
  codeApp.highlightedTagId.value = undefined

  const query = snippet.folder?.id
    ? { folderId: snippet.folder.id, isDeleted: snippet.isDeleted }
    : { isDeleted: snippet.isDeleted }

  if (snippet.folder?.id) {
    await codeFolders.selectFolder(snippet.folder.id, {
      ensureVisibility: true,
    })
  }
  else {
    codeFolders.clearFolderSelection()
    codeApp.state.libraryFilter = snippet.isDeleted
      ? LibraryFilter.Trash
      : LibraryFilter.All
  }

  await codeSnippets.getSnippets(query)
  codeSnippets.selectSnippet(snippet.id)
  await router.push({ name: RouterName.main })
}

async function openNote(note: NoteResult) {
  notesData.isRestoreStateBlocked.value = true
  noteSearch.clearSearch(false)
  notesApp.hideNotesViewModes()
  notesApp.notesState.tagId = undefined
  notesApp.focusedFolderId.value = undefined
  notesApp.highlightedFolderIds.value.clear()
  notesApp.highlightedTagId.value = undefined

  const query = note.folder?.id
    ? { folderId: note.folder.id, isDeleted: note.isDeleted }
    : { isDeleted: note.isDeleted }

  if (note.folder?.id) {
    notesApp.notesState.folderId = note.folder.id
    notesApp.notesState.libraryFilter = undefined
  }
  else {
    notesApp.notesState.folderId = undefined
    notesApp.notesState.libraryFilter = note.isDeleted
      ? LibraryFilter.Trash
      : LibraryFilter.All
  }

  await notesData.getNotes(query)
  notesData.selectNote(note.id)
  await router.push({ name: RouterName.notesSpace })
}

async function openHttpRequest(request: HttpRequestResult) {
  const httpFolders = useHttpFolders()

  httpData.isRestoreStateBlocked.value = true
  httpSearch.clearSearch(false)
  httpApp.focusedFolderId.value = undefined
  httpApp.highlightedFolderIds.value.clear()

  if (request.folderId) {
    await httpFolders.selectHttpFolder(request.folderId, {
      ensureVisibility: true,
    })
  }
  else {
    httpFolders.clearFolderSelection()
  }

  await httpData.getHttpRequests()
  httpData.selectHttpRequest(request.id)
  await router.push({ name: RouterName.httpSpace })
}

async function openRecent(entry: CommandPaletteRecentEntry) {
  if (entry.target === 'space') {
    await openSpace(entry.targetId as SpaceId)
    return
  }

  if (entry.target === 'snippet') {
    const { data } = await api.snippets.getSnippetsById(entry.targetId)
    await openSnippet(data as SnippetItemResponse)
    return
  }

  if (entry.target === 'note') {
    const { data } = await api.notes.getNotesById(entry.targetId)
    await openNote(data as NoteItemResponse)
    return
  }

  const { data } = await api.httpRequests.getHttpRequestsById(entry.targetId)
  await openHttpRequest(data)
}

async function openResult(result: CommandPaletteResult) {
  closePalette()
  clearPalette()

  if (result.type === 'space') {
    await openSpace(result.spaceId)
  }
  else if (result.type === 'snippet') {
    await openSnippet(result.item)
  }
  else if (result.type === 'note') {
    await openNote(result.item)
  }
  else if (result.type === 'http-request') {
    await openHttpRequest(result.item)
  }
  else if (result.type === 'command') {
    await result.command.run()
    return
  }
  else {
    await openRecent(result.recent)
  }

  recordRecentResult(result)
}

useEventListener(window, 'keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
    event.preventDefault()
    togglePalette()
  }
})

watch(isOpen, (open) => {
  if (!open) {
    clearPalette()
  }
})

export function useCommandPalette() {
  return {
    commandResults,
    hasQuery,
    httpRequestResults,
    isOpen,
    isSearching,
    noteResults,
    openPalette,
    openResult,
    query,
    recentResults,
    setQuery,
    snippetResults,
    spaceResults,
  }
}
