import type {
  HttpRequestsResponse,
  NotesResponse,
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
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import { getSpaceDefinitions, type SpaceId } from '@/spaceDefinitions'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { FileText, Globe2 } from 'lucide-vue-next'
import { LibraryFilter } from './types'

type SnippetResult = SnippetsResponse[number]
type NoteResult = NotesResponse[number]
type HttpRequestResult = HttpRequestsResponse[number]

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

const isOpen = ref(false)
const query = ref('')
const isSearching = ref(false)
const snippets = shallowRef<SnippetResult[]>([])
const notes = shallowRef<NoteResult[]>([])
const httpRequests = shallowRef<HttpRequestResult[]>([])
let searchRunId = 0

const notesApp = useNotesApp()
const notesData = useNotes()
const noteSearch = useNoteSearch()
const httpApp = useHttpApp()
const httpData = useHttpRequests()
const httpSearch = useHttpSearch()

function getResultTitle(value: string | undefined, fallback: string) {
  return value?.trim() || fallback
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

const snippetResults = computed<CommandPaletteResult[]>(() =>
  snippets.value.map(snippet => ({
    id: `snippet:${snippet.id}`,
    type: 'snippet',
    title: getResultTitle(snippet.name, i18n.t('snippet.untitled')),
    subtitle: snippet.folder?.name || i18n.t('common.library'),
    icon: FileText,
    item: snippet,
  })),
)

const noteResults = computed<CommandPaletteResult[]>(() =>
  notes.value.map(note => ({
    id: `note:${note.id}`,
    type: 'note',
    title: getResultTitle(note.name, i18n.t('notes.untitled')),
    subtitle: note.folder?.name || i18n.t('common.library'),
    icon: FileText,
    item: note,
  })),
)

const httpRequestResults = computed<CommandPaletteResult[]>(() =>
  httpRequests.value.map(request => ({
    id: `http-request:${request.id}`,
    type: 'http-request',
    title: getResultTitle(request.name, i18n.t('spaces.http.untitledRequest')),
    subtitle: request.url || i18n.t('spaces.http.noUrl'),
    icon: Globe2,
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
      api.snippets.getSnippets({ search, isDeleted: 0 }),
      api.notes.getNotes({ search, isDeleted: 0 }),
      api.httpRequests.getHttpRequests({ search }),
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
  else {
    await openHttpRequest(result.item)
  }
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
    hasQuery,
    httpRequestResults,
    isOpen,
    isSearching,
    noteResults,
    openPalette,
    openResult,
    query,
    setQuery,
    snippetResults,
    spaceResults,
  }
}
