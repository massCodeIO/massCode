import type {
  HttpRequestsResponse,
  NoteItemResponse,
  NotesResponse,
  SnippetItemResponse,
  SnippetsResponse,
} from '@/services/api/generated'
import type { Component } from 'vue'
import type { AiResult } from '~/shared/ai'
import type {
  AiSemanticConfigure,
  AiSemanticSearchResult,
  AiSemanticStatus,
  PaletteMatchReason,
  PaletteSearchItem,
} from '~/shared/aiSemantic'
import {
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
  useHttpSearch,
} from '@/composables/spaces/http'
import { httpRuntimeNavigation } from '@/composables/spaces/http/runtimeNavigation'
import {
  useNotes,
  useNotesApp,
  useNoteSearch,
} from '@/composables/spaces/notes'
import { useImportDialog } from '@/composables/useImportDialog'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc, store } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'
import {
  getActiveSpaceId,
  getSpaceDefinitions,
  type SpaceId,
} from '@/spaceDefinitions'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import {
  ChevronsDown,
  Folder,
  Hash,
  ScanSearch,
  Settings,
  Upload,
} from 'lucide-vue-next'
import {
  createHttpRequestFromPalette,
  getHttpCommands,
} from './command-palette/httpCommands'
import {
  acceptsPaletteResponse,
  type AppliedPaletteResponse,
  buildPaletteSearchPayload,
  DEFERRED_WORDS_MAX_MS,
  FULL_DELAY_MS,
  mergeMeaningResults,
  type PaletteSearchPhase,
  shouldRunFullPhase,
  splitPaletteResults,
  WEAK_PREVIEW_LIMIT,
  WORDS_DEBOUNCE_MS,
} from './command-palette/paletteSearch'
import {
  type CommandPaletteFolderFilter,
  type CommandPaletteFolderOption,
  type CommandPaletteTagFilter,
  type CommandPaletteTagOption,
  getActiveCommandPaletteFilterToken,
  parseCommandPaletteQuery,
} from './command-palette/queryParser'
import { getCommandPaletteUsageScore } from './command-palette/ranking'
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

export interface CommandPaletteCommand {
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

interface CommandPaletteWeakMatchesResult {
  id: string
  type: 'weak-matches'
  title: string
  subtitle: string
  icon: Component
}

interface CommandPaletteMatch {
  reason?: PaletteMatchReason
  excerpt?: PaletteSearchItem['excerpt']
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
  | ({
    id: string
    type: 'snippet'
    title: string
    subtitle: string
    icon: Component
    item: SnippetResult
  } & CommandPaletteMatch)
  | ({
    id: string
    type: 'note'
    title: string
    subtitle: string
    icon: Component
    item: NoteResult
  } & CommandPaletteMatch)
  | ({
    id: string
    type: 'http-request'
    title: string
    subtitle: string
    icon: Component
    item: HttpRequestResult
  } & CommandPaletteMatch)
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
  | CommandPaletteWeakMatchesResult

type CommandPaletteContentResult = Extract<
  CommandPaletteResult,
  { type: 'snippet' | 'note' | 'http-request' }
>

const isOpen = ref(false)
const query = ref('')
const searchScopeSpaceId = ref<SpaceId>()
const searchTagFilter = ref<CommandPaletteTagFilter>()
const searchFolderFilter = ref<CommandPaletteFolderFilter>()
// Только фаза слов: пока её ответа нет, показанный список относится к прошлому вводу.
const isSearching = ref(false)
const searchItems = shallowRef<PaletteSearchItem[]>([])
// Запрос применённого ответа: usage-тайбрейк не должен пересчитываться от ввода, пока ответа на него нет.
const searchItemsQuery = ref('')
const searchStrongCount = ref(0)
const searchFixedCount = ref(0)
const searchMeaning = ref<AiSemanticSearchResult['meaning']>()
const isMeaningPending = ref(false)
// Был ли ответ поиска с последнего сброса: пока он есть, ввод следующей буквы не перестраивает палитру.
const hasSearchResponse = ref(false)
const isWeakExpanded = ref(false)
let appliedSearchResponse: AppliedPaletteResponse | undefined
let wordsRequest:
  | {
    generation: number
    response: Promise<AiSemanticSearchResult | undefined>
  }
  | undefined
// Воркер эмбеддингов считает запросы по очереди: держим один full в полёте, из ожидающих живёт только последний.
let isFullRequestInFlight = false
let pendingFullSearch: { generation: number, search: string } | undefined
// Пустой по словам ответ нового ввода, отложенный до full: применяется, если full не удался или не успел к сроку.
let deferredWordsResponse:
  | {
    generation: number
    search: string
    response: AiSemanticSearchResult
    timer: ReturnType<typeof setTimeout>
  }
  | undefined
const semanticStatus = ref<AiSemanticStatus>()
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
const { sonner } = useSonner()

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

// Записи сниппетов, заметок и запросов ссылаются на id конкретного vault.
// Пространства и команды от vault не зависят, их историю сохраняем.
function resetVaultHistory() {
  saveRecentEntries(
    recentEntries.value.filter(entry => entry.target === 'space'),
  )
  saveUsageEntries(
    usageEntries.value.filter(
      entry => entry.target === 'space' || entry.target === 'command',
    ),
  )
}

function forgetEntry(id: string) {
  saveRecentEntries(recentEntries.value.filter(entry => entry.id !== id))
  saveUsageEntries(usageEntries.value.filter(entry => entry.id !== id))
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

function toSnippetResult(snippet: SnippetResult) {
  return {
    id: `snippet:${snippet.id}`,
    type: 'snippet',
    title: getResultTitle(snippet.name, i18n.t('snippet.untitled')),
    subtitle: snippet.folder?.name || i18n.t('common.library'),
    icon: getSpaceIcon('code'),
    item: snippet,
  } satisfies CommandPaletteResult
}

function toNoteResult(note: NoteResult) {
  return {
    id: `note:${note.id}`,
    type: 'note',
    title: getResultTitle(note.name, i18n.t('notes.untitled')),
    subtitle: note.folder?.name || i18n.t('common.library'),
    icon: getSpaceIcon('notes'),
    item: note,
  } satisfies CommandPaletteResult
}

function toHttpRequestResult(request: HttpRequestResult) {
  return {
    id: `http-request:${request.id}`,
    type: 'http-request',
    title: getResultTitle(request.name, i18n.t('spaces.http.untitledRequest')),
    subtitle: request.url || i18n.t('spaces.http.noUrl'),
    icon: getSpaceIcon('http'),
    item: request,
  } satisfies CommandPaletteResult
}

function toContentResult(
  found: PaletteSearchItem,
): CommandPaletteContentResult {
  const match = {
    reason: found.reason,
    ...(found.excerpt ? { excerpt: found.excerpt } : {}),
  }
  if (found.type === 'snippet')
    return { ...toSnippetResult(found.item as SnippetResult), ...match }
  if (found.type === 'note')
    return { ...toNoteResult(found.item as NoteResult), ...match }
  return {
    ...toHttpRequestResult(found.item as unknown as HttpRequestResult),
    ...match,
  }
}

const splitContentResults = computed(() => {
  const now = Date.now()
  const search = searchItemsQuery.value
  return splitPaletteResults(
    searchItems.value.map(found => ({
      result: toContentResult(found),
      score: found.score,
    })),
    searchStrongCount.value,
    id => getCommandPaletteUsageScore(usageById.value.get(id), search, now),
    searchFixedCount.value,
  )
})

const strongResults = computed<CommandPaletteResult[]>(
  () => splitContentResults.value.strong,
)

const weakResults = computed<CommandPaletteResult[]>(
  () => splitContentResults.value.weak,
)

// Первые слабые видны сразу, остальные за строкой «ещё N», раскрывающей их по Enter или клику.
const weakSectionResults = computed<CommandPaletteResult[]>(() => {
  const count = weakResults.value.length
  if (isWeakExpanded.value || count <= WEAK_PREVIEW_LIMIT)
    return weakResults.value
  return [
    ...weakResults.value.slice(0, WEAK_PREVIEW_LIMIT),
    {
      id: 'weak-matches',
      type: 'weak-matches',
      title: i18n.t('commandPalette.weakerMatches', {
        count: count - WEAK_PREVIEW_LIMIT,
      }),
      subtitle: '',
      icon: ChevronsDown,
    },
  ]
})

const meaningSearchStatus = computed<'searching' | 'warming' | undefined>(
  () => {
    if (isMeaningPending.value)
      return 'searching'
    return searchMeaning.value === 'warming' ? 'warming' : undefined
  },
)

function expandWeakResults() {
  isWeakExpanded.value = true
}

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
  searchItems.value = []
  searchItemsQuery.value = ''
  searchStrongCount.value = 0
  searchFixedCount.value = 0
  searchMeaning.value = undefined
  isMeaningPending.value = false
  isWeakExpanded.value = false
  appliedSearchResponse = undefined
  hasSearchResponse.value = false
  wordsRequest = undefined
  // Флаг полёта не сбрасываем: он отражает занятость воркера и снимается ответом самого запроса.
  pendingFullSearch = undefined
  clearDeferredWords()
}

function clearDeferredWords() {
  if (deferredWordsResponse)
    clearTimeout(deferredWordsResponse.timer)
  deferredWordsResponse = undefined
}

// isMeaningPending не трогаем: full ещё идёт, футер продолжает показывать поиск по смыслу.
function applyDeferredWordsOnTimeout(generation: number) {
  const deferred = deferredWordsResponse
  if (deferred?.generation !== generation)
    return
  clearDeferredWords()
  if (
    applySearchResponse(generation, 'words', deferred.search, deferred.response)
  )
    isSearching.value = false
}

async function requestPaletteSearch(
  search: string,
  mode: PaletteSearchPhase,
): Promise<AiSemanticSearchResult | undefined> {
  const payload = buildPaletteSearchPayload({
    query: search,
    mode,
    scopeSpaceId: searchScopeSpaceId.value,
    tagFilter: searchTagFilter.value,
    folderFilter: searchFolderFilter.value,
  })
  if (!payload)
    return { items: [], strongCount: 0, meaning: 'off' }
  try {
    const result = (await ipc.invoke(
      'system:ai:semantic-search',
      payload,
    )) as AiResult<AiSemanticSearchResult>
    return result.ok ? result.data : undefined
  }
  catch {
    return undefined
  }
}

function getSearchItemId(found: PaletteSearchItem) {
  const type = found.type === 'http_request' ? 'http-request' : found.type
  return `${type}:${String(found.item.id)}`
}

// Сильные слов в том порядке, в каком они уже показаны (после usage-тайбрейка).
function getShownWordsStrongItems() {
  const itemsById = new Map(
    searchItems.value
      .slice(0, searchStrongCount.value)
      .map(found => [getSearchItemId(found), found]),
  )
  return strongResults.value.flatMap((result) => {
    const found = itemsById.get(result.id)
    return found ? [found] : []
  })
}

function applySearchResponse(
  generation: number,
  phase: PaletteSearchPhase,
  search: string,
  response: AiSemanticSearchResult | undefined,
) {
  const accepted = acceptsPaletteResponse(searchRunId, appliedSearchResponse, {
    generation,
    phase,
  })
  if (!accepted)
    return false
  if (phase === 'full')
    isMeaningPending.value = false
  // Сбой full оставляет список слов; сбой words показывает пустой список, а не прошлый ввод.
  if (!response && phase === 'full')
    return true
  // Раскрытые слабые сворачиваются вместе с заменой списка, а не на нажатие: иначе список дёргается на каждой букве.
  if (appliedSearchResponse?.generation !== generation)
    isWeakExpanded.value = false
  const merged
    = phase === 'full'
      && response
      && appliedSearchResponse?.generation === generation
      && appliedSearchResponse.phase === 'words'
      ? mergeMeaningResults({
          wordsStrong: getShownWordsStrongItems(),
          full: response.items,
          fullStrongCount: response.strongCount,
          getKey: getSearchItemId,
        })
      : undefined
  appliedSearchResponse = { generation, phase }
  hasSearchResponse.value = true
  searchItems.value = merged?.items ?? response?.items ?? []
  searchItemsQuery.value = search
  searchStrongCount.value = merged?.strongCount ?? response?.strongCount ?? 0
  searchFixedCount.value = merged?.fixedCount ?? 0
  searchMeaning.value = response?.meaning
  return true
}

async function runSearch(value: string) {
  const search = value.trim()

  if (search !== query.value.trim()) {
    return
  }

  const generation = searchRunId

  if (!search) {
    resetSearchResults()
    isSearching.value = false
    return
  }

  const response = requestPaletteSearch(search, 'words')
  wordsRequest = { generation, response }
  const data = await response
  // Без сильных по словам, но со смысловой фазой впереди: пустой список на миг до full мигал бы.
  // Прежний список остаётся как устаревший (isSearching держится, Enter по нему заблокирован) до ответа full.
  if (
    generation === searchRunId
    && hasSearchResponse.value
    && data
    && data.strongCount === 0
    && shouldRunFullPhase(data.meaning, search)
  ) {
    clearDeferredWords()
    deferredWordsResponse = {
      generation,
      search,
      response: data,
      timer: setTimeout(
        () => applyDeferredWordsOnTimeout(generation),
        DEFERRED_WORDS_MAX_MS,
      ),
    }
    isMeaningPending.value = true
    return
  }
  if (!applySearchResponse(generation, 'words', search, data))
    return
  isSearching.value = false
  isMeaningPending.value = Boolean(
    data && shouldRunFullPhase(data.meaning, search),
  )
}

async function runFullSearch(value: string) {
  const search = value.trim()
  const generation = searchRunId

  if (!search || search !== query.value.trim()) {
    return
  }

  // Смысловая фаза нужна, только если слова для этого же ввода сказали, что индекс готов.
  const words
    = wordsRequest?.generation === generation
      ? await wordsRequest.response
      : undefined
  if (
    !words
    || !shouldRunFullPhase(words.meaning, search)
    || generation !== searchRunId
  ) {
    return
  }

  if (isFullRequestInFlight) {
    pendingFullSearch = { generation, search }
    return
  }

  isFullRequestInFlight = true
  // requestPaletteSearch не бросает: сбой приходит как undefined, флаг снимется всегда.
  const response = await requestPaletteSearch(search, 'full')
  isFullRequestInFlight = false
  const deferred
    = deferredWordsResponse?.generation === generation
      ? deferredWordsResponse.response
      : undefined
  if (applySearchResponse(generation, 'full', search, response) && deferred) {
    clearDeferredWords()
    if (!response)
      applySearchResponse(generation, 'words', search, deferred)
    isSearching.value = false
  }

  const pending = pendingFullSearch
  pendingFullSearch = undefined
  if (
    pending
    && pending.generation === searchRunId
    && pending.search === query.value.trim()
  ) {
    void runFullSearch(pending.search)
  }
}

async function loadSemanticStatus() {
  try {
    const result = (await ipc.invoke(
      'system:ai:semantic',
      null,
    )) as AiResult<AiSemanticStatus>
    if (result.ok)
      semanticStatus.value = result.data
  }
  catch {}
}

async function requestSemantic(
  channel: 'system:ai:semantic-configure' | 'system:ai:semantic-download',
  input: AiSemanticConfigure | null,
) {
  try {
    const result = (await ipc.invoke(
      channel,
      input,
    )) as AiResult<AiSemanticStatus>
    if (!result.ok) {
      sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
      return
    }
    semanticStatus.value = result.data
    return result.data
  }
  catch {
    sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
  }
}

async function enableSemanticSearchFromPalette() {
  const status = await requestSemantic('system:ai:semantic-configure', {
    source: 'builtin',
  })
  if (status?.builtin.state === 'ready') {
    sonner({ type: 'success', message: i18n.t('ai.semantic.enabled') })
  }
  else if (status) {
    if (status.builtin.state !== 'downloading')
      await requestSemantic('system:ai:semantic-download', null)
    sonner({ message: i18n.t('ai.semantic.enabling') })
  }
  // Раздел настроек показывает прогресс загрузки.
  await router.push({ name: RouterName.preferencesSemanticSearch })
}

const debouncedRunWordsSearch = useDebounceFn(runSearch, WORDS_DEBOUNCE_MS)
const debouncedRunFullSearch = useDebounceFn(runFullSearch, FULL_DELAY_MS)

// isMeaningPending меняют только ответы (words ставит, full снимает): сброс на нажатие мигал бы футером.
function debouncedRunSearch(value: string) {
  void debouncedRunWordsSearch(value)
  void debouncedRunFullSearch(value)
}

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
  void loadSemanticStatus()
}

function openCommandMode() {
  isOpen.value = true
  setQuery('>')
  void loadSemanticStatus()
}

function closePalette() {
  isOpen.value = false
}

function togglePalette() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    void loadCommandPaletteFilterOptions()
    void loadSemanticStatus()
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
  const { openSpaceTarget } = await import('@/ipc/listeners/deepLinks')
  await openSpaceTarget(spaceId)
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

async function openPreferencesFromPalette() {
  await router.push({ name: RouterName.preferences })
}

async function openImportFromPalette(
  source: Parameters<typeof importDialog.openImportDialog>[0],
  space?: Parameters<typeof importDialog.openImportDialog>[1],
) {
  importDialog.openImportDialog(source, space)
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
    ...getHttpCommands(),
    {
      id: 'open-preferences',
      title: i18n.t('commandPalette.actions.openPreferences'),
      subtitle: i18n.t('commandPalette.actions.openPreferencesSubtitle'),
      icon: Settings,
      keywords: ['settings', 'preferences'],
      run: openPreferencesFromPalette,
    },
    ...(semanticStatus.value?.source === 'off'
      && semanticStatus.value.builtin.supported
      ? [
          {
            id: 'enable-semantic-search',
            title: i18n.t('commandPalette.actions.enableSemanticSearch'),
            subtitle: i18n.t(
              semanticStatus.value.builtin.state === 'ready'
                ? 'commandPalette.actions.enableSemanticSearchReadySubtitle'
                : 'commandPalette.actions.enableSemanticSearchSubtitle',
            ),
            icon: ScanSearch,
            keywords: ['semantic', 'meaning', 'search', 'embeddings', 'ai'],
            run: enableSemanticSearchFromPalette,
          },
        ]
      : []),
  ]
}

async function openSnippet(snippet: SnippetResult) {
  const { useNavigationHistory } = await import(
    '@/composables/useNavigationHistory'
  )
  await useNavigationHistory().recordNavigation(() =>
    openSnippetInternal(snippet),
  )
}

async function openSnippetInternal(snippet: SnippetResult) {
  if (!(await httpRuntimeNavigation.confirmLeave()))
    return false
  const [{ useApp }, { useFolders }, { useSnippets }] = await Promise.all([
    import('@/composables/useApp'),
    import('@/composables/useFolders'),
    import('@/composables/useSnippets'),
  ])
  const codeApp = useApp()
  if (!codeApp.isCodeSpaceInitialized.value) {
    const { initCodeSpace } = await import('@/composables/useCodeSpaceInit')
    await initCodeSpace()
  }
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
  const { useNavigationHistory } = await import(
    '@/composables/useNavigationHistory'
  )
  await useNavigationHistory().recordNavigation(() => openNoteInternal(note))
}

async function openNoteInternal(note: NoteResult) {
  if (!(await httpRuntimeNavigation.confirmLeave()))
    return false
  const { useNotesSpaceInitialization } = await import(
    '@/composables/spaces/notes/useNotesSpaceInitialization'
  )
  await useNotesSpaceInitialization().initNotesSpace()
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
  const { useNavigationHistory } = await import(
    '@/composables/useNavigationHistory'
  )
  await useNavigationHistory().recordNavigation(() =>
    openHttpRequestInternal(request),
  )
}

async function openHttpRequestInternal(request: HttpRequestResult) {
  if (!(await httpRuntimeNavigation.confirmLeave()))
    return
  const { useHttpSpaceInit } = await import(
    '@/composables/spaces/http/useHttpSpaceInit'
  )
  await useHttpSpaceInit().initHttpSpace()
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
  // Ожидание фактической смены выбора: история/навигация ниже читают уже
  // применённое состояние, а не предыдущий запрос.
  await httpData.selectHttpRequest(request.id)
  if (
    httpApp.httpState.requestId !== request.id
    || httpData.currentRequest.value?.id !== request.id
  ) {
    return false
  }
  await router.push({ name: RouterName.httpSpace })
}

const RECENT_MISSING_MESSAGE_KEYS = {
  'snippet': 'internalLinks.missing.snippet',
  'note': 'internalLinks.missing.note',
  'http-request': 'internalLinks.missing.httpRequest',
} as const

function isNotFoundError(error: unknown) {
  const response = (error as { response?: { status?: number } } | undefined)
    ?.response
  return response?.status === 404
}

async function loadRecentTarget(
  target: Exclude<CommandPaletteRecentTarget, 'space'>,
  id: string,
) {
  if (target === 'snippet') {
    const { data } = await api.snippets.getSnippetsById(id)
    return { target, item: data as SnippetItemResponse }
  }

  if (target === 'note') {
    const { data } = await api.notes.getNotesById(id)
    return { target, item: data as NoteItemResponse }
  }

  const { data } = await api.httpRequests.getHttpRequestsById(id)
  return { target, item: data }
}

async function openRecent(entry: CommandPaletteRecentEntry) {
  if (entry.target === 'space') {
    await openSpace(entry.targetId as SpaceId)
    return true
  }

  let loaded: Awaited<ReturnType<typeof loadRecentTarget>>
  // Только загрузка по id означает «записи нет»: 404 из вложенных шагов
  // открытия не должен удалять существующую запись.
  try {
    loaded = await loadRecentTarget(entry.target, entry.targetId)
  }
  catch (error) {
    if (!isNotFoundError(error))
      throw error

    // Запись удалена вне палитры: убираем её, чтобы она не всплывала снова.
    forgetEntry(entry.id)
    sonner({
      message: i18n.t(RECENT_MISSING_MESSAGE_KEYS[entry.target]),
      type: 'warning',
    })
    return false
  }

  if (loaded.target === 'snippet')
    await openSnippet(loaded.item)
  else if (loaded.target === 'note')
    await openNote(loaded.item)
  else await openHttpRequest(loaded.item)
  return true
}

async function openResult(result: CommandPaletteResult) {
  const lastQuery = query.value.trim()

  if (result.type === 'token-suggestion') {
    result.run()
    return
  }

  if (result.type === 'weak-matches') {
    expandWeakResults()
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
  else if (!(await openRecent(result.recent))) {
    return
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
    createFallbackResults,
    expandWeakResults,
    hasQuery,
    hasSearchResponse,
    isOpen,
    isSearching,
    isSpaceMode,
    isTokenSuggestionMode,
    meaningSearchStatus,
    openCommandMode,
    openPalette,
    openResult,
    query,
    recentResults,
    resetVaultHistory,
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
    spaceResults,
    strongResults,
    tokenSuggestionResults,
    usageById,
    weakResults,
    weakSectionResults,
  }
}
