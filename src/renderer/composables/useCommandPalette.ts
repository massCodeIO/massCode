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
import { useHttpImportDialog } from '@/composables/useHttpImportDialog'
import { useImportDialog } from '@/composables/useImportDialog'
import { i18n, store } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import {
  getActiveSpaceId,
  getSpaceDefinitions,
  type SpaceId,
} from '@/spaceDefinitions'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { Folder, Hash, Settings, Upload } from 'lucide-vue-next'
import {
  type CommandPaletteFolderFilter,
  type CommandPaletteFolderOption,
  type CommandPaletteTagFilter,
  type CommandPaletteTagOption,
  getActiveCommandPaletteFilterToken,
  parseCommandPaletteQuery,
} from './command-palette/queryParser'
import { rankCommandPaletteResults } from './command-palette/ranking'
import { LibraryFilter } from './types'

type SnippetResult = SnippetsResponse[number]
type NoteResult = NotesResponse[number]
type HttpRequestResult = HttpRequestsResponse[number]
type CommandPaletteRecentTarget = 'space' | 'snippet' | 'note' | 'http-request'
type CommandPaletteUsageTarget = CommandPaletteRecentTarget | 'command'
type CommandPaletteCreateTarget = 'snippet' | 'note' | 'http-request'

interface CommandPaletteRecentEntry {
  id: string
  target: CommandPaletteRecentTarget
  targetId: string
  title: string
  subtitle: string
  spaceId: SpaceId
  openedAt: number
}

interface CommandPaletteUsageEntry {
  id: string
  target: CommandPaletteUsageTarget
  targetId: string
  openedAt: number
  openCount: number
  lastQuery?: string
}

interface CommandPaletteCommand {
  id: string
  title: string
  subtitle: string
  icon: Component
  keywords: string[]
  spaceId?: SpaceId
  run: () => Promise<void>
}

interface CommandPaletteTokenSuggestion {
  id: string
  type: 'token-suggestion'
  title: string
  subtitle: string
  icon: Component
  run: () => void
}

interface CommandPaletteCreatePayload {
  name?: string
  url?: string
}

interface CommandPaletteSpaceResult {
  id: string
  type: 'space'
  title: string
  subtitle: string
  icon: Component
  spaceId: SpaceId
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
  | CommandPaletteSpaceResult
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
  | CommandPaletteTokenSuggestion
  | CommandPaletteRecentResult

const isOpen = ref(false)
const query = ref('')
const searchScopeSpaceId = ref<SpaceId>()
const searchTagFilter = ref<CommandPaletteTagFilter>()
const searchFolderFilter = ref<CommandPaletteFolderFilter>()
const isSearching = ref(false)
const settledSearchQuery = ref('')
const snippets = shallowRef<SnippetResult[]>([])
const notes = shallowRef<NoteResult[]>([])
const httpRequests = shallowRef<HttpRequestResult[]>([])
const recentEntries = shallowRef<CommandPaletteRecentEntry[]>(
  store.app.get<CommandPaletteRecentEntry[]>('commandPalette.recent') || [],
)
const usageEntries = shallowRef<CommandPaletteUsageEntry[]>(
  store.app.get<CommandPaletteUsageEntry[]>('commandPalette.usage') || [],
)
const codeTagOptions = shallowRef<CommandPaletteTagOption[]>([])
const noteTagOptions = shallowRef<CommandPaletteTagOption[]>([])
const codeFolderOptions = shallowRef<CommandPaletteFolderOption[]>([])
const noteFolderOptions = shallowRef<CommandPaletteFolderOption[]>([])
const httpFolderOptions = shallowRef<CommandPaletteFolderOption[]>([])
let searchRunId = 0
const RECENT_LIMIT = 30
const ROOT_RECENT_LIMIT = 3
const SCOPED_RECENT_LIMIT = 5
const TOKEN_SUGGESTION_LIMIT = 8
const USAGE_LIMIT = 100

const notesApp = useNotesApp()
const notesData = useNotes()
const noteSearch = useNoteSearch()
const httpApp = useHttpApp()
const httpData = useHttpRequests()
const httpSearch = useHttpSearch()
const importDialog = useImportDialog()
const httpImportDialog = useHttpImportDialog()

const SEARCHABLE_SPACE_IDS = new Set<SpaceId>(['code', 'notes', 'http'])

const searchTagOptions = computed<CommandPaletteTagOption[]>(() => [
  ...codeTagOptions.value,
  ...noteTagOptions.value,
])

const searchFolderOptions = computed<CommandPaletteFolderOption[]>(() => [
  ...codeFolderOptions.value,
  ...noteFolderOptions.value,
  ...httpFolderOptions.value,
])

const searchFilterTokens = computed(() => {
  const tokens: { clearLabel: string, id: string, label: string }[] = []

  if (searchFolderFilter.value) {
    const label = `/${searchFolderFilter.value.path}`
    tokens.push({
      clearLabel: i18n.t('commandPalette.clearFilter', { filter: label }),
      id: 'folder',
      label,
    })
  }

  if (searchTagFilter.value) {
    const label = `#${searchTagFilter.value.name}`
    tokens.push({
      clearLabel: i18n.t('commandPalette.clearFilter', { filter: label }),
      id: 'tag',
      label,
    })
  }

  return tokens
})

const activeFilterToken = computed(() =>
  getActiveCommandPaletteFilterToken(query.value),
)
const isTokenSuggestionMode = computed(() => Boolean(activeFilterToken.value))

const tokenSuggestionResults = computed<CommandPaletteTokenSuggestion[]>(() => {
  const activeToken = activeFilterToken.value
  if (!activeToken) {
    return []
  }

  const normalizedPrefix = normalizeSearchToken(activeToken.prefix)
  const effectiveSpaceId = searchScopeSpaceId.value

  if (activeToken.kind === 'tag') {
    return searchTagOptions.value
      .filter(
        option =>
          isTokenOptionVisible(option.spaceId, effectiveSpaceId)
          && normalizeSearchToken(option.name).startsWith(normalizedPrefix)
          && option.id !== searchTagFilter.value?.id,
      )
      .slice(0, TOKEN_SUGGESTION_LIMIT)
      .map(option => ({
        id: `token-suggestion:tag:${option.spaceId}:${option.id}`,
        type: 'token-suggestion' as const,
        title: `#${option.name}`,
        subtitle: i18n.t('commandPalette.suggestions.tagSubtitle', {
          space: getSpaceLabel(option.spaceId),
        }),
        icon: Hash,
        run: () => applyTagSuggestion(option),
      }))
  }

  return searchFolderOptions.value
    .filter(
      option =>
        isTokenOptionVisible(option.spaceId, effectiveSpaceId)
        && (normalizeSearchToken(option.path).startsWith(normalizedPrefix)
          || normalizeSearchToken(option.name).startsWith(normalizedPrefix))
        && option.id !== searchFolderFilter.value?.id,
    )
    .slice(0, TOKEN_SUGGESTION_LIMIT)
    .map(option => ({
      id: `token-suggestion:folder:${option.spaceId}:${option.id}`,
      type: 'token-suggestion' as const,
      title: `/${option.path}`,
      subtitle: i18n.t('commandPalette.suggestions.folderSubtitle', {
        space: getSpaceLabel(option.spaceId),
      }),
      icon: Folder,
      run: () => applyFolderSuggestion(option),
    }))
})

const scopedHomeFilterResults = computed<CommandPaletteTokenSuggestion[]>(
  () => {
    const scopeSpaceId = searchScopeSpaceId.value
    if (!scopeSpaceId) {
      return []
    }

    return [
      ...searchFolderOptions.value
        .filter(option => option.spaceId === scopeSpaceId)
        .slice(0, TOKEN_SUGGESTION_LIMIT)
        .map(option => ({
          id: `token-suggestion:folder:${option.spaceId}:${option.id}`,
          type: 'token-suggestion' as const,
          title: `/${option.path}`,
          subtitle: i18n.t('commandPalette.suggestions.folderSubtitle', {
            space: getSpaceLabel(option.spaceId),
          }),
          icon: Folder,
          run: () => applyFolderSuggestion(option),
        })),
      ...searchTagOptions.value
        .filter(option => option.spaceId === scopeSpaceId)
        .slice(0, TOKEN_SUGGESTION_LIMIT)
        .map(option => ({
          id: `token-suggestion:tag:${option.spaceId}:${option.id}`,
          type: 'token-suggestion' as const,
          title: `#${option.name}`,
          subtitle: i18n.t('commandPalette.suggestions.tagSubtitle', {
            space: getSpaceLabel(option.spaceId),
          }),
          icon: Hash,
          run: () => applyTagSuggestion(option),
        })),
    ].slice(0, TOKEN_SUGGESTION_LIMIT)
  },
)

async function loadCommandPaletteFilterOptions() {
  const [
    codeTagsResult,
    noteTagsResult,
    codeFoldersResult,
    noteFoldersResult,
    httpFoldersResult,
  ] = await Promise.allSettled([
    api.tags.getTags(),
    api.noteTags.getNoteTags(),
    api.folders.getFoldersTree(),
    api.noteFolders.getNoteFoldersTree(),
    api.httpFolders.getHttpFoldersTree(),
  ])

  if (codeTagsResult.status === 'fulfilled') {
    codeTagOptions.value = codeTagsResult.value.data.map(tag => ({
      id: tag.id,
      name: tag.name,
      spaceId: 'code',
    }))
  }

  if (noteTagsResult.status === 'fulfilled') {
    noteTagOptions.value = noteTagsResult.value.data.map(tag => ({
      id: tag.id,
      name: tag.name,
      spaceId: 'notes',
    }))
  }

  if (codeFoldersResult.status === 'fulfilled') {
    codeFolderOptions.value = getCommandPaletteFolderOptions(
      codeFoldersResult.value.data,
      'code',
    )
  }

  if (noteFoldersResult.status === 'fulfilled') {
    noteFolderOptions.value = getCommandPaletteFolderOptions(
      noteFoldersResult.value.data,
      'notes',
    )
  }

  if (httpFoldersResult.status === 'fulfilled') {
    httpFolderOptions.value = getCommandPaletteFolderOptions(
      httpFoldersResult.value.data,
      'http',
    )
  }

  applyLoadedSearchFilterOptions()
}

interface CommandPaletteFolderTreeItem {
  id: number
  name: string
  children?: CommandPaletteFolderTreeItem[]
}

function getCommandPaletteFolderOptions(
  folders: CommandPaletteFolderTreeItem[],
  spaceId: CommandPaletteFolderOption['spaceId'],
  parentPath = '',
): CommandPaletteFolderOption[] {
  return folders.flatMap((folder) => {
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name

    return [
      {
        id: folder.id,
        name: folder.name,
        path,
        spaceId,
      },
      ...getCommandPaletteFolderOptions(folder.children ?? [], spaceId, path),
    ]
  })
}

function getResultTitle(value: string | undefined, fallback: string) {
  return value?.trim() || fallback
}

function getSpaceIcon(spaceId: SpaceId) {
  return getSpaceDefinitions().find(space => space.id === spaceId)!.icon
}

function getSpaceLabel(spaceId: SpaceId) {
  return getSpaceDefinitions().find(space => space.id === spaceId)!.label
}

function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase()
}

function isTokenOptionVisible(
  spaceId: SpaceId,
  effectiveSpaceId: SpaceId | undefined,
) {
  return !effectiveSpaceId || effectiveSpaceId === spaceId
}

function getQueryWithoutActiveFilterToken() {
  return query.value.replace(/(?:^|\s)[#/]\S*$/, '').trim()
}

function saveRecentEntries(entries: CommandPaletteRecentEntry[]) {
  recentEntries.value = entries
  store.app.set('commandPalette.recent', JSON.parse(JSON.stringify(entries)))
}

function saveUsageEntries(entries: CommandPaletteUsageEntry[]) {
  usageEntries.value = entries
  store.app.set('commandPalette.usage', JSON.parse(JSON.stringify(entries)))
}

function getUsageEntryFromResult(
  result: CommandPaletteResult,
): Omit<CommandPaletteUsageEntry, 'openCount' | 'openedAt'> | null {
  if (result.type === 'recent') {
    return {
      id: result.recent.id,
      target: result.recent.target,
      targetId: result.recent.targetId,
    }
  }

  if (result.type === 'command') {
    return {
      id: `command:${result.command.id}`,
      target: 'command',
      targetId: result.command.id,
    }
  }

  const recentEntry = getRecentEntryFromResult(result)

  return recentEntry
    ? {
        id: recentEntry.id,
        target: recentEntry.target,
        targetId: recentEntry.targetId,
      }
    : null
}

function recordUsageResult(result: CommandPaletteResult, lastQuery: string) {
  const entry = getUsageEntryFromResult(result)

  if (!entry) {
    return
  }

  const previousEntry = usageEntries.value.find(item => item.id === entry.id)
  const nextEntry: CommandPaletteUsageEntry = {
    ...entry,
    openedAt: Date.now(),
    openCount: (previousEntry?.openCount || 0) + 1,
    ...(lastQuery ? { lastQuery } : {}),
  }

  saveUsageEntries(
    [
      nextEntry,
      ...usageEntries.value.filter(item => item.id !== nextEntry.id),
    ].slice(0, USAGE_LIMIT),
  )
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

const spaceResults = computed<CommandPaletteSpaceResult[]>(() =>
  getSpaceDefinitions().map(space => ({
    id: `space:${space.id}`,
    type: 'space',
    title: space.label,
    subtitle: space.tooltip,
    icon: space.icon,
    spaceId: space.id,
  })),
)

const scopeSpaceResults = computed<CommandPaletteSpaceResult[]>(() =>
  spaceResults.value.filter(result =>
    SEARCHABLE_SPACE_IDS.has(result.spaceId),
  ),
)

const searchScope = computed(() =>
  getSpaceDefinitions().find(space => space.id === searchScopeSpaceId.value),
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

function getRecentResult(entry: CommandPaletteRecentEntry) {
  return {
    id: `recent:${entry.id}`,
    type: 'recent',
    title: entry.title,
    subtitle: entry.subtitle,
    icon: getSpaceIcon(entry.spaceId),
    recent: entry,
  } satisfies CommandPaletteResult
}

const recentResults = computed<CommandPaletteResult[]>(() =>
  recentEntries.value.slice(0, ROOT_RECENT_LIMIT).map(getRecentResult),
)

const scopedRecentResults = computed<CommandPaletteResult[]>(() =>
  recentEntries.value
    .filter(entry => entry.spaceId === searchScopeSpaceId.value)
    .slice(0, SCOPED_RECENT_LIMIT)
    .map(getRecentResult),
)

const usageById = computed(
  () => new Map(usageEntries.value.map(entry => [entry.id, entry])),
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

const contentResults = computed<CommandPaletteResult[]>(() =>
  rankCommandPaletteResults(
    [
      ...snippetResults.value,
      ...noteResults.value,
      ...httpRequestResults.value,
    ],
    {
      query: isSearching.value ? settledSearchQuery.value : query.value,
      usageById: usageById.value,
    },
  ),
)

const hasQuery = computed(() => query.value.trim().length > 0)
const isCommandMode = computed(
  () => !searchScopeSpaceId.value && query.value.startsWith('>'),
)
const isSpaceMode = computed(
  () => !searchScopeSpaceId.value && query.value.startsWith('@'),
)

const createFallbackResults = computed<CommandPaletteResult[]>(() => {
  const search = query.value.trim()

  if (!search || isCommandMode.value || isSpaceMode.value) {
    return []
  }

  return getCreateFallbackTargets(searchScopeSpaceId.value, search).map(
    target => getCreateFallbackResult(target, search),
  )
})

function resetSearchResults() {
  settledSearchQuery.value = ''
  snippets.value = []
  notes.value = []
  httpRequests.value = []
}

async function runSearch(value: string) {
  const search = value.trim()
  const scopeSpaceId = searchScopeSpaceId.value
  const tagFilter = searchTagFilter.value
  const folderFilter = searchFolderFilter.value

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

  const shouldSearchSnippets = !scopeSpaceId || scopeSpaceId === 'code'
  const shouldSearchNotes = !scopeSpaceId || scopeSpaceId === 'notes'
  const shouldSearchHttpRequests = !scopeSpaceId || scopeSpaceId === 'http'
  const snippetTagId = tagFilter?.spaceId === 'code' ? tagFilter.id : undefined
  const noteTagId = tagFilter?.spaceId === 'notes' ? tagFilter.id : undefined
  const snippetFolderId
    = folderFilter?.spaceId === 'code' ? folderFilter.id : undefined
  const noteFolderId
    = folderFilter?.spaceId === 'notes' ? folderFilter.id : undefined
  const httpFolderId
    = folderFilter?.spaceId === 'http' ? folderFilter.id : undefined
  const [snippetsResult, notesResult, httpRequestsResult]
    = await Promise.allSettled([
      shouldSearchSnippets
        ? api.snippets.getSnippets({
            search,
            searchNameOnly: 1,
            folderId: snippetFolderId,
            isDeleted: 0,
            tagId: snippetTagId,
          })
        : Promise.resolve({ data: [] as SnippetResult[] }),
      shouldSearchNotes
        ? api.notes.getNotes({
            search,
            searchNameOnly: 1,
            folderId: noteFolderId,
            isDeleted: 0,
            tagId: noteTagId,
          })
        : Promise.resolve({ data: [] as NoteResult[] }),
      shouldSearchHttpRequests
        ? api.httpRequests.getHttpRequests({
            search,
            searchNameOnly: 1,
            folderId: httpFolderId,
          })
        : Promise.resolve({ data: [] as HttpRequestResult[] }),
    ])

  if (
    runId !== searchRunId
    || search !== query.value.trim()
    || scopeSpaceId !== searchScopeSpaceId.value
    || tagFilter?.id !== searchTagFilter.value?.id
    || folderFilter?.id !== searchFolderFilter.value?.id
  ) {
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
  settledSearchQuery.value = search
  isSearching.value = false
}

const debouncedRunSearch = useDebounceFn(runSearch, 180)

function finishFilterSuggestion(search: string) {
  searchRunId += 1
  query.value = search
  resetSearchResults()

  if (!search) {
    isSearching.value = false
    return
  }

  isSearching.value = true
  debouncedRunSearch(search)
}

function applyTagSuggestion(option: CommandPaletteTagOption) {
  const search = getQueryWithoutActiveFilterToken()

  if (searchScopeSpaceId.value !== option.spaceId) {
    searchFolderFilter.value = undefined
  }

  searchScopeSpaceId.value = option.spaceId
  searchTagFilter.value = option
  finishFilterSuggestion(search)
}

function applyFolderSuggestion(option: CommandPaletteFolderOption) {
  const search = getQueryWithoutActiveFilterToken()

  if (searchScopeSpaceId.value !== option.spaceId) {
    searchTagFilter.value = undefined
  }

  searchScopeSpaceId.value = option.spaceId
  searchFolderFilter.value = option
  finishFilterSuggestion(search)
}

function hasSearchFilterToken(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .some(
      word =>
        (word.startsWith('#') || word.startsWith('/')) && word.length > 1,
    )
}

function applyLoadedSearchFilterOptions() {
  if (!isOpen.value || !hasSearchFilterToken(query.value)) {
    return
  }

  setQuery(query.value)
}

function getParsedSpaceScopeQuery(value: string) {
  if (!searchScopeSpaceId.value && value.trimStart().startsWith('>')) {
    return null
  }

  const parsedQuery = parseCommandPaletteQuery(value, scopeSpaceResults.value, {
    activeScopeSpaceId: searchScopeSpaceId.value,
    folderOptions: searchFolderOptions.value,
    tagOptions: searchTagOptions.value,
  })
  if (!parsedQuery.scopeSpaceId) {
    return parsedQuery.tagFilter || parsedQuery.folderFilter
      ? parsedQuery
      : null
  }

  return parsedQuery
}

function setQuery(value: string) {
  const parsedScopeQuery = getParsedSpaceScopeQuery(value)

  if (
    parsedScopeQuery?.scopeSpaceId
    || parsedScopeQuery?.tagFilter
    || parsedScopeQuery?.folderFilter
  ) {
    searchRunId += 1
    query.value = parsedScopeQuery.query
    if (parsedScopeQuery.scopeSpaceId) {
      searchScopeSpaceId.value = parsedScopeQuery.scopeSpaceId
      searchTagFilter.value = undefined
      searchFolderFilter.value = undefined
    }
    if (parsedScopeQuery.tagFilter) {
      searchTagFilter.value = parsedScopeQuery.tagFilter
    }
    if (parsedScopeQuery.folderFilter) {
      searchFolderFilter.value = parsedScopeQuery.folderFilter
    }
    resetSearchResults()

    if (!parsedScopeQuery.query.trim()) {
      isSearching.value = false
      return
    }

    isSearching.value = true
    debouncedRunSearch(parsedScopeQuery.query)
    return
  }

  const search = value.trim()

  searchRunId += 1
  query.value = value

  if (!search || isCommandMode.value || isSpaceMode.value) {
    resetSearchResults()
    isSearching.value = false
    return
  }

  isSearching.value = true
  debouncedRunSearch(value)
}

function openPalette() {
  isOpen.value = true
  void loadCommandPaletteFilterOptions()
}

function openCommandMode() {
  isOpen.value = true
  setQuery('>')
}

function closePalette() {
  isOpen.value = false
}

function togglePalette() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    void loadCommandPaletteFilterOptions()
  }
}

function clearPalette() {
  searchRunId += 1
  query.value = ''
  searchScopeSpaceId.value = undefined
  searchTagFilter.value = undefined
  searchFolderFilter.value = undefined
  resetSearchResults()
  isSearching.value = false
}

function selectSearchScope(spaceId: SpaceId) {
  if (!SEARCHABLE_SPACE_IDS.has(spaceId)) {
    return
  }

  searchRunId += 1
  searchScopeSpaceId.value = spaceId
  searchTagFilter.value = undefined
  searchFolderFilter.value = undefined
  query.value = ''
  resetSearchResults()
  isSearching.value = false
}

function clearSearchScope() {
  searchRunId += 1
  searchScopeSpaceId.value = undefined
  searchTagFilter.value = undefined
  searchFolderFilter.value = undefined
  query.value = ''
  resetSearchResults()
  isSearching.value = false
}

function clearSearchFilterToken(id: string) {
  if (id !== 'tag' && id !== 'folder') {
    return
  }

  searchRunId += 1
  if (id === 'tag') {
    searchTagFilter.value = undefined
  }
  else {
    searchFolderFilter.value = undefined
  }
  resetSearchResults()

  const search = query.value.trim()
  if (!search) {
    isSearching.value = false
    return
  }

  isSearching.value = true
  debouncedRunSearch(query.value)
}

async function openSpace(spaceId: SpaceId) {
  const space = getSpaceDefinitions().find(item => item.id === spaceId)
  if (space) {
    await router.push(space.to)
  }
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

function getCreateFallbackTargets(
  spaceId: SpaceId | undefined,
  search: string,
): CommandPaletteCreateTarget[] {
  if (spaceId === 'code') {
    return ['snippet']
  }

  if (spaceId === 'notes') {
    return ['note']
  }

  if (spaceId === 'http') {
    return ['http-request']
  }

  return isHttpUrl(search)
    ? ['http-request', 'snippet', 'note']
    : ['snippet', 'note', 'http-request']
}

function getCreateFallbackResult(
  target: CommandPaletteCreateTarget,
  search: string,
) {
  const isUrl = target === 'http-request' && isHttpUrl(search)
  const command: CommandPaletteCommand = {
    id: `create-${target}-fallback:${search}`,
    title:
      target === 'snippet'
        ? i18n.t('commandPalette.fallbacks.createSnippet', { query: search })
        : target === 'note'
          ? i18n.t('commandPalette.fallbacks.createNote', { query: search })
          : isUrl
            ? i18n.t('commandPalette.fallbacks.createHttpRequestFromUrl')
            : i18n.t('commandPalette.fallbacks.createHttpRequest', {
                query: search,
              }),
    subtitle:
      target === 'snippet'
        ? i18n.t('commandPalette.fallbacks.createSnippetSubtitle')
        : target === 'note'
          ? i18n.t('commandPalette.fallbacks.createNoteSubtitle')
          : i18n.t('commandPalette.fallbacks.createHttpRequestSubtitle'),
    icon: getSpaceIcon(
      target === 'snippet' ? 'code' : target === 'note' ? 'notes' : 'http',
    ),
    keywords: ['create', search],
    spaceId:
      target === 'snippet' ? 'code' : target === 'note' ? 'notes' : 'http',
    run: () =>
      target === 'snippet'
        ? createSnippetFromPalette({ name: search })
        : target === 'note'
          ? createNoteFromPalette({ name: search })
          : createHttpRequestFromPalette(
              isUrl ? { url: search } : { name: search },
            ),
  }

  return {
    id: `command:${command.id}`,
    type: 'command',
    title: command.title,
    subtitle: command.subtitle,
    icon: command.icon,
    command,
  } satisfies CommandPaletteResult
}

async function createSnippetFromPalette(payload?: CommandPaletteCreatePayload) {
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
  await codeSnippets.createSnippetAndSelect(
    payload?.name ? { name: payload.name } : undefined,
  )
}

async function createNoteFromPalette(payload?: CommandPaletteCreatePayload) {
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
  await notesApi.createNoteAndSelect(
    payload?.name ? { name: payload.name } : undefined,
  )
}

async function createHttpRequestFromPalette(
  payload?: CommandPaletteCreatePayload,
) {
  const httpFolders = useHttpFolders()
  const httpRequestsApi = useHttpRequests()

  httpRequestsApi.isRestoreStateBlocked.value = true
  httpSearch.clearSearch(false)
  httpFolders.clearFolderSelection()
  httpApp.httpState.libraryFilter = LibraryFilter.Inbox
  httpApp.focusedFolderId.value = undefined
  httpApp.highlightedFolderIds.value.clear()

  await router.push({ name: RouterName.httpSpace })
  await httpRequestsApi.createHttpRequestAndSelect({
    folderId: null,
    ...(payload?.name && { name: payload.name }),
    ...(payload?.url !== undefined && { url: payload.url }),
  })
}

async function createCodeFolderFromPalette() {
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
  codeApp.focusedFolderId.value = undefined
  codeApp.highlightedFolderIds.value.clear()
  codeApp.highlightedTagId.value = undefined

  await router.push({ name: RouterName.main })
  await codeFolders.createFolderAndSelect()
}

async function createNotesFolderFromPalette() {
  const { useNoteFolders } = await import('@/composables/spaces/notes')
  const noteFolders = useNoteFolders()
  const notesApi = useNotes()

  notesApi.isRestoreStateBlocked.value = true
  noteSearch.clearSearch(false)
  notesApp.hideNotesViewModes()
  notesApp.notesState.tagId = undefined
  notesApp.focusedFolderId.value = undefined
  notesApp.highlightedFolderIds.value.clear()
  notesApp.highlightedTagId.value = undefined

  await router.push({ name: RouterName.notesSpace })
  await noteFolders.createNoteFolderAndSelect()
}

async function createHttpFolderFromPalette() {
  const httpFolders = useHttpFolders()
  const httpRequestsApi = useHttpRequests()

  httpRequestsApi.isRestoreStateBlocked.value = true
  httpSearch.clearSearch(false)
  httpApp.focusedFolderId.value = undefined
  httpApp.highlightedFolderIds.value.clear()

  await router.push({ name: RouterName.httpSpace })
  await httpFolders.createHttpFolderAndSelect()
}

async function openPreferencesFromPalette() {
  await router.push({ name: RouterName.preferences })
}

async function openImportFromPalette(
  source: Parameters<typeof importDialog.openImportDialog>[0],
  space?: Parameters<typeof importDialog.openImportDialog>[1],
) {
  importDialog.openImportDialog(source, space)
}

async function openHttpImportFromPalette() {
  await router.push({ name: RouterName.httpSpace })
  httpImportDialog.openHttpImportDialog()
}

function getCommandDefinitions(): CommandPaletteCommand[] {
  return [
    {
      id: 'new-snippet',
      title: i18n.t('commandPalette.actions.newSnippet'),
      subtitle: i18n.t('commandPalette.actions.newSnippetSubtitle'),
      icon: getSpaceIcon('code'),
      keywords: ['create', 'code', 'snippet'],
      spaceId: 'code',
      run: createSnippetFromPalette,
    },
    {
      id: 'new-code-folder',
      title: i18n.t('commandPalette.actions.newCodeFolder'),
      subtitle: i18n.t('commandPalette.actions.newCodeFolderSubtitle'),
      icon: getSpaceIcon('code'),
      keywords: ['create', 'code', 'folder'],
      spaceId: 'code',
      run: createCodeFolderFromPalette,
    },
    {
      id: 'import-snippets',
      title: i18n.t('commandPalette.actions.importSnippets'),
      subtitle: i18n.t('commandPalette.actions.importSnippetsSubtitle'),
      icon: Upload,
      keywords: [
        'import',
        'vscode',
        'raycast',
        'github',
        'gist',
        'gists',
        'snippetslab',
        'snippet',
        'snippets',
      ],
      spaceId: 'code',
      run: () => openImportFromPalette('vscode-snippets', 'code'),
    },
    {
      id: 'new-note',
      title: i18n.t('commandPalette.actions.newNote'),
      subtitle: i18n.t('commandPalette.actions.newNoteSubtitle'),
      icon: getSpaceIcon('notes'),
      keywords: ['create', 'notes', 'note'],
      spaceId: 'notes',
      run: createNoteFromPalette,
    },
    {
      id: 'new-notes-folder',
      title: i18n.t('commandPalette.actions.newNotesFolder'),
      subtitle: i18n.t('commandPalette.actions.newNotesFolderSubtitle'),
      icon: getSpaceIcon('notes'),
      keywords: ['create', 'notes', 'note', 'folder'],
      spaceId: 'notes',
      run: createNotesFolderFromPalette,
    },
    {
      id: 'import-notes',
      title: i18n.t('commandPalette.actions.importNotes'),
      subtitle: i18n.t('commandPalette.actions.importNotesSubtitle'),
      icon: Upload,
      keywords: ['import', 'obsidian', 'markdown', 'notes'],
      spaceId: 'notes',
      run: () => openImportFromPalette('obsidian', 'notes'),
    },
    {
      id: 'new-http-request',
      title: i18n.t('commandPalette.actions.newHttpRequest'),
      subtitle: i18n.t('commandPalette.actions.newHttpRequestSubtitle'),
      icon: getSpaceIcon('http'),
      keywords: ['create', 'http', 'request'],
      spaceId: 'http',
      run: createHttpRequestFromPalette,
    },
    {
      id: 'new-http-folder',
      title: i18n.t('commandPalette.actions.newHttpFolder'),
      subtitle: i18n.t('commandPalette.actions.newHttpFolderSubtitle'),
      icon: getSpaceIcon('http'),
      keywords: ['create', 'http', 'request', 'folder'],
      spaceId: 'http',
      run: createHttpFolderFromPalette,
    },
    {
      id: 'import-http-collection',
      title: i18n.t('commandPalette.actions.importHttpCollection'),
      subtitle: i18n.t('commandPalette.actions.importHttpCollectionSubtitle'),
      icon: Upload,
      keywords: [
        'import',
        'http',
        'openapi',
        'postman',
        'bruno',
        'collection',
        'environment',
      ],
      spaceId: 'http',
      run: openHttpImportFromPalette,
    },
    {
      id: 'open-preferences',
      title: i18n.t('commandPalette.actions.openPreferences'),
      subtitle: i18n.t('commandPalette.actions.openPreferencesSubtitle'),
      icon: Settings,
      keywords: ['settings', 'preferences'],
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
    httpApp.httpState.libraryFilter = undefined
  }
  else {
    httpFolders.clearFolderSelection()
    httpApp.httpState.libraryFilter = request.isDeleted
      ? LibraryFilter.Trash
      : LibraryFilter.Inbox
  }

  await httpData.getHttpRequests(
    request.folderId
      ? { folderId: request.folderId, isDeleted: request.isDeleted }
      : request.isDeleted
        ? { isDeleted: 1 }
        : { isInbox: 1 },
  )
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
  const lastQuery = query.value.trim()

  if (result.type === 'token-suggestion') {
    result.run()
    return
  }

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
    recordUsageResult(result, lastQuery)
    return
  }
  else {
    await openRecent(result.recent)
  }

  recordRecentResult(result)
  recordUsageResult(result, lastQuery)
}

useEventListener(window, 'keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
    event.preventDefault()
    if (event.shiftKey) {
      openCommandMode()
      return
    }

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
    contentResults,
    createFallbackResults,
    hasQuery,
    httpRequestResults,
    isOpen,
    isSearching,
    isSpaceMode,
    isTokenSuggestionMode,
    noteResults,
    openCommandMode,
    openPalette,
    openResult,
    query,
    recentResults,
    scopeSpaceResults,
    scopedRecentResults,
    scopedHomeFilterResults,
    searchScope,
    searchScopeSpaceId,
    searchFilterTokens,
    selectSearchScope,
    clearSearchFilterToken,
    clearSearchScope,
    setQuery,
    snippetResults,
    spaceResults,
    tokenSuggestionResults,
    usageById,
  }
}
