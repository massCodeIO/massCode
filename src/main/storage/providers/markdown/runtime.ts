import type { FolderRecord, SnippetRecord, TagRecord } from '../../contracts'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { store } from '../../../store'

export const META_DIR_NAME = '.masscode'
const STATE_FILE_NAME = 'state.json'
export const INBOX_DIR_NAME = 'inbox'
export const TRASH_DIR_NAME = 'trash'
const FOLDER_META_FILE_NAME = '.masscode-folder.yml'

const INBOX_RELATIVE_PATH = `${META_DIR_NAME}/${INBOX_DIR_NAME}`
const TRASH_RELATIVE_PATH = `${META_DIR_NAME}/${TRASH_DIR_NAME}`
const LEGACY_INBOX_RELATIVE_PATH = INBOX_DIR_NAME
const LEGACY_TRASH_RELATIVE_PATH = TRASH_DIR_NAME

const RESERVED_ROOT_NAMES = new Set([INBOX_DIR_NAME, TRASH_DIR_NAME])
const NEW_LINE_SPLIT_RE = /\r?\n/
const SEARCH_DIACRITICS_RE = /[\u0300-\u036F]/g
const SEARCH_WORD_RE = /[\p{L}\p{N}_]+/gu
const STATE_WRITE_DEBOUNCE_MS = 100
export const INVALID_NAME_CHARS_RE = /[<>:"/\\|?*]/g
const INVALID_NAME_CHARS = new Set([
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '|',
  '?',
  '*',
])
export const WINDOWS_RESERVED_NAME_RE
  = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

let markdownRuntimeCache: MarkdownRuntimeCache | null = null
const pendingStateWriteByPath = new Map<string, string>()
const stateContentCacheByPath = new Map<string, string>()
const stateFlushTimerByPath = new Map<string, NodeJS.Timeout>()
let stateWriteHooksRegistered = false

export interface MarkdownTagState extends TagRecord {
  createdAt: number
  updatedAt: number
}

export interface MarkdownSnippetIndexItem {
  filePath: string
  id: number
}

export interface MarkdownFolderMetadataFile {
  createdAt?: number
  defaultLanguage?: string
  icon?: string | null
  masscode_id?: number
  name?: string
  orderIndex?: number
  updatedAt?: number
}

export interface MarkdownFolderDiskEntry {
  metadata: MarkdownFolderMetadataFile
  path: string
}

export interface MarkdownFolderUIState {
  isOpen: number
}

export interface MarkdownStateFile {
  counters?: {
    contentId?: number
    folderId?: number
    snippetId?: number
    tagId?: number
  }
  folderUi?: Record<string, { isOpen?: number }>
  folders?: FolderRecord[]
  snippets?: MarkdownSnippetIndexItem[]
  tags?: MarkdownTagState[]
  version?: number
}

export interface MarkdownState {
  counters: {
    contentId: number
    folderId: number
    snippetId: number
    tagId: number
  }
  folderUi: Record<string, MarkdownFolderUIState>
  folders: FolderRecord[]
  snippets: MarkdownSnippetIndexItem[]
  tags: MarkdownTagState[]
  version: number
}

export interface MarkdownFrontmatterContent {
  id?: number
  label?: string
  language?: string
}

export interface MarkdownSnippetFrontmatter {
  contents?: MarkdownFrontmatterContent[]
  createdAt?: number
  description?: string | null
  folderId?: number | null
  id?: number
  isDeleted?: number
  isFavorites?: number
  name?: string
  tags?: number[]
  updatedAt?: number
}

export interface MarkdownBodyFragment {
  label: string
  language: string
  value: string | null
}

export interface MarkdownSnippet {
  contents: {
    id: number
    label: string
    language: string
    value: string | null
  }[]
  createdAt: number
  description: string | null
  filePath: string
  folderId: number | null
  id: number
  isDeleted: number
  isFavorites: number
  name: string
  tags: number[]
  updatedAt: number
}

export interface MarkdownRuntimeCache {
  contentOwnerByContentId: Map<
    number,
    {
      contentIndex: number
      snippet: MarkdownSnippet
    }
  >
  folderById: Map<number, FolderRecord>
  paths: Paths
  searchQueryCache: Map<string, number[]>
  searchSnippetTextById: Map<number, string>
  searchTokenToSnippetIds: Map<string, Set<number>>
  searchTokensBySnippetId: Map<number, string[]>
  searchIndexDirty: boolean
  snippetById: Map<number, MarkdownSnippet>
  snippets: MarkdownSnippet[]
  state: MarkdownState
}

export interface SaveStateOptions {
  immediate?: boolean
}

export interface SqliteSnippetRow {
  createdAt: number
  description: string | null
  folderId: number | null
  id: number
  isDeleted: number
  isFavorites: number
  name: string
  updatedAt: number
}

export interface SqliteSnippetContentRow {
  id: number
  label: string | null
  language: string | null
  snippetId: number
  value: string | null
}

export interface SqliteSnippetTagRow {
  snippetId: number
  tagId: number
}

export interface Paths {
  inboxDirPath: string
  metaDirPath: string
  statePath: string
  trashDirPath: string
  vaultPath: string
}

export type MarkdownErrorCode =
  | 'FOLDER_NOT_FOUND'
  | 'INVALID_NAME'
  | 'NAME_CONFLICT'
  | 'RESERVED_NAME'
  | 'SNIPPET_NOT_FOUND'

function createDefaultState(): MarkdownState {
  return {
    counters: {
      contentId: 0,
      folderId: 0,
      snippetId: 0,
      tagId: 0,
    },
    folderUi: {},
    folders: [],
    snippets: [],
    tags: [],
    version: 2,
  }
}

function throwStorageError(code: MarkdownErrorCode, message: string): never {
  throw new Error(`${code}:${message}`)
}

function getVaultPath(): string {
  const configuredVaultPath = store.preferences.get('storage.vaultPath') as
    | string
    | null
    | undefined

  if (configuredVaultPath && configuredVaultPath.trim()) {
    return configuredVaultPath
  }

  const storagePath = store.preferences.get('storagePath') as string
  return path.join(storagePath, 'markdown-vault')
}

function getPaths(vaultPath: string): Paths {
  const metaDirPath = path.join(vaultPath, META_DIR_NAME)

  return {
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    metaDirPath,
    statePath: path.join(metaDirPath, STATE_FILE_NAME),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
    vaultPath,
  }
}

function toPosixPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

function depthOfRelativePath(relativePath: string): number {
  if (!relativePath) {
    return 0
  }

  return relativePath.split('/').length
}

function normalizeDirectoryPath(relativePath: string): string {
  if (!relativePath || relativePath === '.') {
    return ''
  }

  return toPosixPath(relativePath)
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeFlag(value: unknown, fallback = 0): number {
  return normalizeNumber(value, fallback) ? 1 : 0
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.trunc(parsed)
  return integer > 0 ? integer : null
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected storage error'
}

function normalizeSearchValue(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  return value
    .normalize('NFD')
    .replace(SEARCH_DIACRITICS_RE, '')
    .toLocaleLowerCase()
}

function splitSearchWords(value: string): string[] {
  return value.match(SEARCH_WORD_RE) || []
}

function createWordTrigrams(value: string): string[] {
  if (value.length < 3) {
    return []
  }

  const trigrams: string[] = []
  for (let index = 0; index <= value.length - 3; index += 1) {
    trigrams.push(value.slice(index, index + 3))
  }

  return trigrams
}

function buildSearchTokens(normalizedText: string): string[] {
  const uniqueTokens = new Set<string>()
  const words = splitSearchWords(normalizedText)

  words.forEach((word) => {
    uniqueTokens.add(`w:${word}`)
    createWordTrigrams(word).forEach(trigram =>
      uniqueTokens.add(`g:${trigram}`),
    )
  })

  return [...uniqueTokens]
}

function getSnippetSearchText(snippet: MarkdownSnippet): string {
  return normalizeSearchValue(
    [
      snippet.name,
      snippet.description || '',
      ...snippet.contents.map(content => content.value || ''),
    ].join('\n'),
  )
}

function buildSearchIndex(snippets: MarkdownSnippet[]): {
  searchSnippetTextById: Map<number, string>
  searchTokenToSnippetIds: Map<string, Set<number>>
  searchTokensBySnippetId: Map<number, string[]>
} {
  const searchSnippetTextById = new Map<number, string>()
  const searchTokenToSnippetIds = new Map<string, Set<number>>()
  const searchTokensBySnippetId = new Map<number, string[]>()

  snippets.forEach((snippet) => {
    const searchText = getSnippetSearchText(snippet)
    const tokens = buildSearchTokens(searchText)

    searchSnippetTextById.set(snippet.id, searchText)
    searchTokensBySnippetId.set(snippet.id, tokens)

    tokens.forEach((token) => {
      const tokenBucket
        = searchTokenToSnippetIds.get(token) || new Set<number>()
      tokenBucket.add(snippet.id)
      searchTokenToSnippetIds.set(token, tokenBucket)
    })
  })

  return {
    searchSnippetTextById,
    searchTokenToSnippetIds,
    searchTokensBySnippetId,
  }
}

function invalidateRuntimeSearchIndex(state: MarkdownState): void {
  if (!markdownRuntimeCache || markdownRuntimeCache.state !== state) {
    return
  }

  markdownRuntimeCache.searchIndexDirty = true
  markdownRuntimeCache.searchQueryCache.clear()
}

function ensureRuntimeSearchIndex(
  snippets: MarkdownSnippet[],
): MarkdownRuntimeCache | null {
  const runtimeCache
    = markdownRuntimeCache?.snippets === snippets ? markdownRuntimeCache : null

  if (!runtimeCache) {
    return null
  }

  if (!runtimeCache.searchIndexDirty) {
    return runtimeCache
  }

  const {
    searchSnippetTextById,
    searchTokenToSnippetIds,
    searchTokensBySnippetId,
  } = buildSearchIndex(snippets)

  runtimeCache.searchSnippetTextById = searchSnippetTextById
  runtimeCache.searchTokenToSnippetIds = searchTokenToSnippetIds
  runtimeCache.searchTokensBySnippetId = searchTokensBySnippetId
  runtimeCache.searchQueryCache.clear()
  runtimeCache.searchIndexDirty = false

  return runtimeCache
}

function intersectSnippetIdSets(
  firstSet: Set<number>,
  secondSet: Set<number>,
): Set<number> {
  const [smallSet, largeSet]
    = firstSet.size <= secondSet.size
      ? [firstSet, secondSet]
      : [secondSet, firstSet]
  const intersection = new Set<number>()

  smallSet.forEach((id) => {
    if (largeSet.has(id)) {
      intersection.add(id)
    }
  })

  return intersection
}

function getSnippetIdsBySearchQuery(
  snippets: MarkdownSnippet[],
  searchQuery: string,
): Set<number> {
  const normalizedSearchQuery = normalizeSearchValue(searchQuery).trim()
  if (!normalizedSearchQuery) {
    return new Set(snippets.map(snippet => snippet.id))
  }

  const runtimeCache = ensureRuntimeSearchIndex(snippets)
  if (!runtimeCache) {
    return new Set(
      snippets
        .filter(snippet =>
          getSnippetSearchText(snippet).includes(normalizedSearchQuery),
        )
        .map(snippet => snippet.id),
    )
  }

  const cachedSnippetIds = runtimeCache.searchQueryCache.get(
    normalizedSearchQuery,
  )
  if (cachedSnippetIds) {
    return new Set(cachedSnippetIds)
  }

  const queryWords = splitSearchWords(normalizedSearchQuery)
  const queryTrigrams = new Set<string>()
  queryWords.forEach((word) => {
    createWordTrigrams(word).forEach(trigram =>
      queryTrigrams.add(`g:${trigram}`),
    )
  })

  let candidateSnippetIds: Set<number> | null = null

  for (const token of queryTrigrams) {
    const tokenMatches = runtimeCache.searchTokenToSnippetIds.get(token)
    if (!tokenMatches) {
      runtimeCache.searchQueryCache.set(normalizedSearchQuery, [])
      return new Set()
    }

    candidateSnippetIds = candidateSnippetIds
      ? intersectSnippetIdSets(candidateSnippetIds, tokenMatches)
      : new Set(tokenMatches)

    if (candidateSnippetIds.size === 0) {
      runtimeCache.searchQueryCache.set(normalizedSearchQuery, [])
      return new Set()
    }
  }

  const matchedSnippetIds: number[] = []
  const snippetIdsToCheck
    = candidateSnippetIds || new Set(snippets.map(snippet => snippet.id))

  snippetIdsToCheck.forEach((snippetId) => {
    const searchText = runtimeCache.searchSnippetTextById.get(snippetId) || ''
    if (searchText.includes(normalizedSearchQuery)) {
      matchedSnippetIds.push(snippetId)
    }
  })

  runtimeCache.searchQueryCache.set(normalizedSearchQuery, matchedSnippetIds)
  return new Set(matchedSnippetIds)
}

function normalizeFolderUiState(
  value: unknown,
): Record<string, MarkdownFolderUIState> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const normalized: Record<string, MarkdownFolderUIState> = {}
  for (const [rawFolderId, rawUiState] of Object.entries(value)) {
    const folderId = normalizePositiveInteger(rawFolderId)
    if (!folderId) {
      continue
    }

    const isOpen
      = rawUiState && typeof rawUiState === 'object'
        ? normalizeFlag((rawUiState as { isOpen?: number }).isOpen)
        : 0

    normalized[String(folderId)] = { isOpen }
  }

  return normalized
}

function getFolderMetaFilePath(
  paths: Paths,
  folderRelativePath: string,
): string {
  return path.join(paths.vaultPath, folderRelativePath, FOLDER_META_FILE_NAME)
}

function readFolderMetadata(
  paths: Paths,
  folderRelativePath: string,
): MarkdownFolderMetadataFile {
  const metadataPath = getFolderMetaFilePath(paths, folderRelativePath)

  if (!fs.pathExistsSync(metadataPath)) {
    return {}
  }

  try {
    const source = fs.readFileSync(metadataPath, 'utf8')
    const parsed = yaml.load(source)

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed as MarkdownFolderMetadataFile
  }
  catch {
    return {}
  }
}

function serializeFolderMetadata(folder: FolderRecord): string {
  const payload: MarkdownFolderMetadataFile = {
    createdAt: folder.createdAt,
    defaultLanguage: folder.defaultLanguage,
    icon: folder.icon,
    masscode_id: folder.id,
    name: folder.name,
    orderIndex: folder.orderIndex,
    updatedAt: folder.updatedAt,
  }

  const body = yaml
    .dump(payload, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  return `${body}\n`
}

function writeFolderMetadataFile(
  paths: Paths,
  folderRelativePath: string,
  folder: FolderRecord,
): void {
  const metadataPath = getFolderMetaFilePath(paths, folderRelativePath)
  const nextContent = serializeFolderMetadata(folder)

  if (fs.pathExistsSync(metadataPath)) {
    const currentContent = fs.readFileSync(metadataPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.writeFileSync(metadataPath, nextContent, 'utf8')
}

function isInboxSnippetDirectory(directoryPath: string): boolean {
  return (
    directoryPath === ''
    || directoryPath === INBOX_RELATIVE_PATH
    || directoryPath === LEGACY_INBOX_RELATIVE_PATH
  )
}

function isTrashSnippetDirectory(directoryPath: string): boolean {
  return (
    directoryPath === TRASH_RELATIVE_PATH
    || directoryPath === LEGACY_TRASH_RELATIVE_PATH
  )
}

function normalizeName(name: string): string {
  return name.trim()
}

function hasInvalidNameChars(name: string): boolean {
  for (const char of name) {
    if (INVALID_NAME_CHARS.has(char)) {
      return true
    }

    if (char.charCodeAt(0) <= 0x1F) {
      return true
    }
  }

  return false
}

function validateEntryName(name: string, kind: 'folder' | 'snippet'): string {
  const normalized = normalizeName(name)

  if (!normalized || normalized === '.' || normalized === '..') {
    throwStorageError('INVALID_NAME', `${kind} name is empty or invalid`)
  }

  if (hasInvalidNameChars(normalized)) {
    throwStorageError(
      'INVALID_NAME',
      `${kind} name contains invalid characters`,
    )
  }

  if (normalized.endsWith('.') || normalized.endsWith(' ')) {
    throwStorageError(
      'INVALID_NAME',
      `${kind} name cannot end with a space or dot`,
    )
  }

  if (WINDOWS_RESERVED_NAME_RE.test(normalized)) {
    throwStorageError('INVALID_NAME', `${kind} name is reserved on Windows`)
  }

  return normalized
}

function toSnippetFileName(name: string): string {
  const normalized = validateEntryName(name, 'snippet')

  if (normalized.toLowerCase().endsWith('.md')) {
    return normalized
  }

  return `${normalized}.md`
}

function splitFrontmatter(source: string): {
  body: string
  frontmatter: MarkdownSnippetFrontmatter
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    return { body: source, frontmatter: {} }
  }

  const parsed = yaml.load(match[1])

  return {
    body: match[2] || '',
    frontmatter:
      parsed && typeof parsed === 'object'
        ? (parsed as MarkdownSnippetFrontmatter)
        : {},
  }
}

function parseBodyFragments(body: string): MarkdownBodyFragment[] {
  const fragments: MarkdownBodyFragment[] = []
  const lines = body.split(NEW_LINE_SPLIT_RE)

  let lineIndex = 0
  while (lineIndex < lines.length) {
    const line = lines[lineIndex]

    if (!line.startsWith('## Fragment:')) {
      lineIndex += 1
      continue
    }

    const label = line.slice('## Fragment:'.length).trim() || 'Fragment'
    lineIndex += 1

    if (lineIndex >= lines.length || !lines[lineIndex].startsWith('```')) {
      continue
    }

    const language = lines[lineIndex].slice(3).trim() || 'plain_text'
    lineIndex += 1

    const valueLines: string[] = []
    while (lineIndex < lines.length && !lines[lineIndex].startsWith('```')) {
      valueLines.push(lines[lineIndex])
      lineIndex += 1
    }

    if (lineIndex < lines.length && lines[lineIndex].startsWith('```')) {
      lineIndex += 1
    }

    fragments.push({
      label,
      language,
      value: valueLines.join('\n'),
    })
  }

  if (fragments.length === 0 && body.trim()) {
    fragments.push({
      label: 'Fragment 1',
      language: 'plain_text',
      value: body,
    })
  }

  return fragments
}

function ensureStateFile(paths: Paths): void {
  registerStateWriteHooks()

  fs.ensureDirSync(paths.vaultPath)
  fs.ensureDirSync(paths.metaDirPath)
  fs.ensureDirSync(paths.inboxDirPath)
  fs.ensureDirSync(paths.trashDirPath)

  if (!fs.pathExistsSync(paths.statePath)) {
    const defaultStateContent = `${JSON.stringify(createDefaultState(), null, 2)}\n`
    fs.writeFileSync(paths.statePath, defaultStateContent, 'utf8')
    stateContentCacheByPath.set(paths.statePath, defaultStateContent)
  }
}

function loadState(paths: Paths): MarkdownState {
  ensureStateFile(paths)

  const defaultState = createDefaultState()
  const rawState = fs.readJSONSync(paths.statePath) as MarkdownStateFile
  const legacyFolders = Array.isArray(rawState.folders) ? rawState.folders : []
  const folderUi = normalizeFolderUiState(rawState.folderUi)

  if (Object.keys(folderUi).length === 0 && legacyFolders.length) {
    legacyFolders.forEach((folder) => {
      folderUi[String(folder.id)] = {
        isOpen: normalizeFlag(folder.isOpen),
      }
    })
  }

  return {
    counters: {
      ...defaultState.counters,
      ...rawState.counters,
    },
    folderUi,
    folders: legacyFolders,
    snippets: Array.isArray(rawState.snippets) ? rawState.snippets : [],
    tags: Array.isArray(rawState.tags) ? rawState.tags : [],
    version:
      typeof rawState.version === 'number'
        ? rawState.version
        : defaultState.version,
  }
}

function getPersistedStateContent(statePath: string): string {
  const cachedStateContent = stateContentCacheByPath.get(statePath)
  if (cachedStateContent !== undefined) {
    return cachedStateContent
  }

  const persistedStateContent = fs.pathExistsSync(statePath)
    ? fs.readFileSync(statePath, 'utf8')
    : ''

  stateContentCacheByPath.set(statePath, persistedStateContent)
  return persistedStateContent
}

function flushPendingStateWriteByPath(statePath: string): void {
  const pendingStateContent = pendingStateWriteByPath.get(statePath)
  if (pendingStateContent === undefined) {
    return
  }

  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
    stateFlushTimerByPath.delete(statePath)
  }

  const persistedStateContent = getPersistedStateContent(statePath)
  if (persistedStateContent !== pendingStateContent) {
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, pendingStateContent, 'utf8')
  }

  stateContentCacheByPath.set(statePath, pendingStateContent)
  pendingStateWriteByPath.delete(statePath)
}

function scheduleStateFlush(statePath: string): void {
  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
  }

  const nextFlushTimer = setTimeout(
    () => flushPendingStateWriteByPath(statePath),
    STATE_WRITE_DEBOUNCE_MS,
  )
  stateFlushTimerByPath.set(statePath, nextFlushTimer)
}

function flushPendingStateWrite(paths: Paths): void {
  flushPendingStateWriteByPath(paths.statePath)
}

function flushPendingStateWrites(): void {
  const pathsWithPendingWrites = [...pendingStateWriteByPath.keys()]
  pathsWithPendingWrites.forEach(statePath =>
    flushPendingStateWriteByPath(statePath),
  )
}

function registerStateWriteHooks(): void {
  if (stateWriteHooksRegistered) {
    return
  }

  stateWriteHooksRegistered = true
  process.once('beforeExit', flushPendingStateWrites)
  process.once('exit', flushPendingStateWrites)
}

function saveState(
  paths: Paths,
  state: MarkdownState,
  options?: SaveStateOptions,
): void {
  syncFolderUiWithFolders(state)
  invalidateRuntimeSearchIndex(state)

  const nextVersion = Math.max(state.version, 2)
  state.version = nextVersion

  const persistedState: MarkdownStateFile = {
    counters: state.counters,
    folderUi: state.folderUi,
    snippets: state.snippets,
    tags: state.tags,
    version: nextVersion,
  }

  const nextContent = `${JSON.stringify(persistedState, null, 2)}\n`
  const statePath = paths.statePath
  const pendingContent = pendingStateWriteByPath.get(statePath)
  if (pendingContent === nextContent) {
    return
  }

  const persistedContent = getPersistedStateContent(statePath)
  if (persistedContent === nextContent && pendingContent === undefined) {
    return
  }

  pendingStateWriteByPath.set(statePath, nextContent)

  if (options?.immediate) {
    flushPendingStateWrite(paths)
    return
  }

  scheduleStateFlush(statePath)
}

function listMarkdownFiles(rootPath: string, currentPath = rootPath): string[] {
  if (!fs.pathExistsSync(currentPath)) {
    return []
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true })
  const files: string[] = []

  entries.forEach((entry) => {
    const absolutePath = path.join(currentPath, entry.name)
    const isHiddenEntry = entry.name.startsWith('.')

    if (entry.isDirectory()) {
      if (currentPath === rootPath && entry.name === META_DIR_NAME) {
        const inboxPath = path.join(absolutePath, INBOX_DIR_NAME)
        const trashPath = path.join(absolutePath, TRASH_DIR_NAME)

        files.push(...listMarkdownFiles(rootPath, inboxPath))
        files.push(...listMarkdownFiles(rootPath, trashPath))
        return
      }

      if (isHiddenEntry) {
        return
      }

      files.push(...listMarkdownFiles(rootPath, absolutePath))
      return
    }

    if (entry.isFile() && !isHiddenEntry && entry.name.endsWith('.md')) {
      const relativePath = path.relative(rootPath, absolutePath)
      files.push(toPosixPath(relativePath))
    }
  })

  return files
}

function listUserFolders(
  paths: Paths,
  currentPath = paths.vaultPath,
): MarkdownFolderDiskEntry[] {
  if (!fs.pathExistsSync(currentPath)) {
    return []
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true })
  const folders: MarkdownFolderDiskEntry[] = []

  entries.forEach((entry) => {
    if (!entry.isDirectory()) {
      return
    }

    if (
      currentPath === paths.vaultPath
      && (entry.name === META_DIR_NAME
        || entry.name === INBOX_DIR_NAME
        || entry.name === TRASH_DIR_NAME)
    ) {
      return
    }

    const absolutePath = path.join(currentPath, entry.name)
    const relativePath = toPosixPath(
      path.relative(paths.vaultPath, absolutePath),
    )

    folders.push({
      metadata: readFolderMetadata(paths, relativePath),
      path: relativePath,
    })
    folders.push(...listUserFolders(paths, absolutePath))
  })

  return folders
}

function buildFolderPathMap(state: MarkdownState): Map<number, string> {
  const folderById = new Map<number, FolderRecord>()
  state.folders.forEach(folder => folderById.set(folder.id, folder))

  const resolvedMap = new Map<number, string>()
  const visiting = new Set<number>()

  const resolveFolderPath = (folderId: number): string => {
    const existingPath = resolvedMap.get(folderId)
    if (existingPath !== undefined) {
      return existingPath
    }

    const folder = folderById.get(folderId)
    if (!folder) {
      return ''
    }

    if (visiting.has(folderId)) {
      return folder.name
    }

    visiting.add(folderId)

    const parentPath
      = folder.parentId !== null ? resolveFolderPath(folder.parentId) : ''
    const currentPath = parentPath
      ? path.posix.join(parentPath, folder.name)
      : folder.name

    resolvedMap.set(folderId, currentPath)
    visiting.delete(folderId)

    return currentPath
  }

  state.folders.forEach(folder => resolveFolderPath(folder.id))

  return resolvedMap
}

function buildPathToFolderIdMap(state: MarkdownState): Map<string, number> {
  const folderPathMap = buildFolderPathMap(state)
  const pathMap = new Map<string, number>()

  folderPathMap.forEach((folderPath, folderId) => {
    pathMap.set(folderPath, folderId)
  })

  return pathMap
}

function findFolderById(
  state: MarkdownState,
  folderId: number,
): FolderRecord | undefined {
  const runtimeCache
    = markdownRuntimeCache?.state === state ? markdownRuntimeCache : null

  if (runtimeCache) {
    if (runtimeCache.folderById.size !== state.folders.length) {
      runtimeCache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )
    }

    const folderFromIndex = runtimeCache.folderById.get(folderId)
    if (folderFromIndex) {
      return folderFromIndex
    }
  }

  const folder = state.folders.find(item => item.id === folderId)
  if (folder && runtimeCache) {
    runtimeCache.folderById.set(folderId, folder)
  }

  return folder
}

function getFolderPathById(
  state: MarkdownState,
  folderId: number,
): string | null {
  const folderPathMap = buildFolderPathMap(state)
  return folderPathMap.get(folderId) || null
}

function getFolderSiblings(
  state: MarkdownState,
  parentId: number | null,
  excludeId?: number,
): FolderRecord[] {
  return state.folders.filter((folder) => {
    if (folder.parentId !== parentId) {
      return false
    }

    if (excludeId !== undefined && folder.id === excludeId) {
      return false
    }

    return true
  })
}

function assertUniqueSiblingFolderName(
  state: MarkdownState,
  parentId: number | null,
  name: string,
  excludeId?: number,
): void {
  const normalizedName = name.toLowerCase()

  const hasConflict = getFolderSiblings(state, parentId, excludeId).some(
    folder => folder.name.toLowerCase() === normalizedName,
  )

  if (hasConflict) {
    throwStorageError(
      'NAME_CONFLICT',
      'Folder with this name already exists on this level',
    )
  }
}

function resolveUniqueSiblingFolderName(
  state: MarkdownState,
  parentId: number | null,
  name: string,
  excludeId?: number,
): string {
  const siblings = getFolderSiblings(state, parentId, excludeId)
  const siblingNames = new Set(
    siblings.map(folder => folder.name.toLowerCase()),
  )

  if (!siblingNames.has(name.toLowerCase())) {
    return name
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidateName = `${name} ${suffix}`

    if (!siblingNames.has(candidateName.toLowerCase())) {
      return candidateName
    }
  }

  throwStorageError(
    'NAME_CONFLICT',
    'Cannot generate unique folder name on this level',
  )
}

function assertNotReservedRootFolderName(
  parentId: number | null,
  name: string,
): void {
  const normalizedName = name.toLowerCase()

  if (normalizedName === META_DIR_NAME) {
    throwStorageError('RESERVED_NAME', 'This folder name is reserved')
  }

  if (parentId === null && RESERVED_ROOT_NAMES.has(normalizedName)) {
    throwStorageError(
      'RESERVED_NAME',
      'This folder name is reserved for technical folder',
    )
  }
}

function assertDirectoryNameAvailable(
  paths: Paths,
  parentRelativePath: string,
  folderName: string,
  excludeRelativePath?: string,
): void {
  const parentAbsolutePath = parentRelativePath
    ? path.join(paths.vaultPath, parentRelativePath)
    : paths.vaultPath
  fs.ensureDirSync(parentAbsolutePath)

  const excludeAbsolutePath = excludeRelativePath
    ? path.join(paths.vaultPath, excludeRelativePath)
    : null

  const entries = fs.readdirSync(parentAbsolutePath)
  const normalizedFolderName = folderName.toLowerCase()

  for (const entry of entries) {
    const entryAbsolutePath = path.join(parentAbsolutePath, entry)

    if (excludeAbsolutePath && entryAbsolutePath === excludeAbsolutePath) {
      continue
    }

    if (entry.toLowerCase() === normalizedFolderName) {
      throwStorageError(
        'NAME_CONFLICT',
        'Folder with this name already exists on this level',
      )
    }
  }
}

function getNextFolderOrder(
  state: MarkdownState,
  parentId: number | null,
): number {
  return (
    state.folders
      .filter(folder => folder.parentId === parentId)
      .reduce((maxOrder, folder) => Math.max(maxOrder, folder.orderIndex), -1)
      + 1
  )
}

function syncFolderUiWithFolders(state: MarkdownState): void {
  const nextFolderUi: Record<string, MarkdownFolderUIState> = {}

  state.folders.forEach((folder) => {
    const isOpen = normalizeFlag(folder.isOpen)

    folder.isOpen = isOpen
    nextFolderUi[String(folder.id)] = { isOpen }
  })

  state.folderUi = nextFolderUi
}

function syncFoldersWithDisk(paths: Paths, state: MarkdownState): void {
  const diskFolders = listUserFolders(paths)
  const oldFoldersById = new Map<number, FolderRecord>(
    state.folders.map(folder => [folder.id, folder]),
  )
  const oldFolderPathMap = buildFolderPathMap(state)
  const oldFolderIdByPath = new Map<string, number>()
  oldFolderPathMap.forEach((folderPath, folderId) => {
    oldFolderIdByPath.set(folderPath, folderId)
  })

  const orderedDiskFolders = [...diskFolders].sort((a, b) => {
    const depthA = depthOfRelativePath(a.path)
    const depthB = depthOfRelativePath(b.path)

    if (depthA !== depthB) {
      return depthA - depthB
    }

    return a.path.localeCompare(b.path)
  })

  const nextFoldersState: FolderRecord[] = []
  const pathToFolderId = new Map<string, number>()
  const usedFolderIds = new Set<number>()
  let nextFolderId = Math.max(
    state.counters.folderId,
    ...state.folders.map(folder => folder.id),
  )

  for (const diskFolder of orderedDiskFolders) {
    const metadata = diskFolder.metadata
    const folderPath = diskFolder.path
    const parentPath = normalizeDirectoryPath(path.posix.dirname(folderPath))
    const parentId = parentPath ? pathToFolderId.get(parentPath) || null : null

    const metadataFolderId = normalizePositiveInteger(metadata.masscode_id)
    const pathFolderId = oldFolderIdByPath.get(folderPath) || null

    let folderId
      = metadataFolderId && !usedFolderIds.has(metadataFolderId)
        ? metadataFolderId
        : null

    if (!folderId && pathFolderId && !usedFolderIds.has(pathFolderId)) {
      folderId = pathFolderId
    }

    if (!folderId) {
      nextFolderId += 1
      folderId = nextFolderId
    }

    usedFolderIds.add(folderId)
    pathToFolderId.set(folderPath, folderId)

    const previousFolder = oldFoldersById.get(folderId)
    const now = Date.now()
    const createdAt = normalizeNumber(
      metadata.createdAt,
      previousFolder?.createdAt ?? now,
    )
    const updatedAt = normalizeNumber(
      metadata.updatedAt,
      previousFolder?.updatedAt ?? createdAt,
    )
    const defaultLanguage
      = typeof metadata.defaultLanguage === 'string'
        && metadata.defaultLanguage.trim()
        ? metadata.defaultLanguage
        : previousFolder?.defaultLanguage || 'plain_text'
    const icon
      = metadata.icon === null
        ? null
        : typeof metadata.icon === 'string'
          ? metadata.icon
          : (previousFolder?.icon ?? null)
    const fallbackOrderIndex
      = nextFoldersState
        .filter(folder => folder.parentId === parentId)
        .reduce(
          (maxOrder, folder) => Math.max(maxOrder, folder.orderIndex),
          -1,
        ) + 1
    const orderIndex = Math.max(
      0,
      Math.trunc(
        normalizeNumber(
          metadata.orderIndex,
          previousFolder?.orderIndex ?? fallbackOrderIndex,
        ),
      ),
    )

    nextFoldersState.push({
      createdAt,
      defaultLanguage,
      icon,
      id: folderId,
      isOpen: normalizeFlag(
        state.folderUi[String(folderId)]?.isOpen,
        previousFolder?.isOpen ?? 0,
      ),
      name: path.posix.basename(folderPath),
      orderIndex,
      parentId,
      updatedAt,
    })
  }

  state.folders = nextFoldersState
  state.counters.folderId = Math.max(state.counters.folderId, nextFolderId)
  syncFolderUiWithFolders(state)
}

function syncFolderMetadataFiles(paths: Paths, state: MarkdownState): void {
  const folderPathMap = buildFolderPathMap(state)

  folderPathMap.forEach((folderPath, folderId) => {
    const folder = findFolderById(state, folderId)
    if (!folder) {
      return
    }

    writeFolderMetadataFile(paths, folderPath, folder)
  })
}

function readFrontmatterIdFromSnippetFile(snippetPath: string): number | null {
  if (!fs.pathExistsSync(snippetPath)) {
    return null
  }

  const source = fs.readFileSync(snippetPath, 'utf8')
  const { frontmatter } = splitFrontmatter(source)
  const id = normalizeNumber(frontmatter.id)

  return id > 0 ? id : null
}

function readSnippetFromFile(
  paths: Paths,
  entry: MarkdownSnippetIndexItem,
  pathToFolderIdMap: ReadonlyMap<string, number>,
): MarkdownSnippet | null {
  const snippetPath = path.join(paths.vaultPath, entry.filePath)

  if (!fs.pathExistsSync(snippetPath)) {
    return null
  }

  const source = fs.readFileSync(snippetPath, 'utf8')
  const { body, frontmatter } = splitFrontmatter(source)
  const fragments = parseBodyFragments(body)
  const metaContents = Array.isArray(frontmatter.contents)
    ? frontmatter.contents
    : []

  const contents = fragments.length
    ? fragments.map((fragment, index) => {
        const meta = metaContents[index]
        const metaId = normalizeNumber(meta?.id)

        return {
          id: metaId > 0 ? metaId : index + 1,
          label: fragment.label,
          language: fragment.language,
          value: fragment.value,
        }
      })
    : metaContents.map((meta, index) => {
        const metaId = normalizeNumber(meta.id)

        return {
          id: metaId > 0 ? metaId : index + 1,
          label: meta.label || `Fragment ${index + 1}`,
          language: meta.language || 'plain_text',
          value: '',
        }
      })

  const normalizedFileDirectory = normalizeDirectoryPath(
    path.posix.dirname(entry.filePath),
  )

  let folderId = normalizeNullableNumber(frontmatter.folderId)
  if (isInboxSnippetDirectory(normalizedFileDirectory)) {
    folderId = null
  }
  else if (!isTrashSnippetDirectory(normalizedFileDirectory)) {
    folderId = pathToFolderIdMap.get(normalizedFileDirectory) || null
  }

  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags
        .map(tagId => normalizeNumber(tagId))
        .filter(tagId => tagId > 0)
    : []

  const inferredName = path.posix.basename(entry.filePath, '.md')

  return {
    contents,
    createdAt: normalizeNumber(frontmatter.createdAt, Date.now()),
    description:
      typeof frontmatter.description === 'string'
      || frontmatter.description === null
        ? frontmatter.description
        : null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: isTrashSnippetDirectory(normalizedFileDirectory)
      ? 1
      : normalizeNumber(frontmatter.isDeleted),
    isFavorites: normalizeNumber(frontmatter.isFavorites),
    name:
      typeof frontmatter.name === 'string' ? frontmatter.name : inferredName,
    tags,
    updatedAt: normalizeNumber(frontmatter.updatedAt, Date.now()),
  }
}

function loadSnippets(paths: Paths, state: MarkdownState): MarkdownSnippet[] {
  const pathToFolderIdMap = buildPathToFolderIdMap(state)

  return state.snippets
    .map(item => readSnippetFromFile(paths, item, pathToFolderIdMap))
    .filter((snippet): snippet is MarkdownSnippet => !!snippet)
}

function syncCounters(state: MarkdownState, snippets: MarkdownSnippet[]): void {
  const maxFolderId = state.folders.reduce(
    (maxId, folder) => Math.max(maxId, folder.id),
    0,
  )
  const maxTagId = state.tags.reduce(
    (maxId, tag) => Math.max(maxId, tag.id),
    0,
  )
  const maxSnippetId = state.snippets.reduce(
    (maxId, snippet) => Math.max(maxId, snippet.id),
    0,
  )
  const maxContentId = snippets.reduce((maxId, snippet) => {
    const snippetMaxContentId = snippet.contents.reduce(
      (contentMaxId, content) => Math.max(contentMaxId, content.id),
      0,
    )

    return Math.max(maxId, snippetMaxContentId)
  }, 0)

  state.counters.folderId = Math.max(state.counters.folderId, maxFolderId)
  state.counters.tagId = Math.max(state.counters.tagId, maxTagId)
  state.counters.snippetId = Math.max(state.counters.snippetId, maxSnippetId)
  state.counters.contentId = Math.max(state.counters.contentId, maxContentId)
}

function syncStateWithDisk(paths: Paths): MarkdownState {
  flushPendingStateWrite(paths)

  const state = loadState(paths)
  syncFoldersWithDisk(paths, state)

  const relativeSnippetFiles = listMarkdownFiles(paths.vaultPath)
  const fileSet = new Set(relativeSnippetFiles)
  const existingIdSet = new Set<number>(state.snippets.map(item => item.id))

  state.snippets = state.snippets.filter(item => fileSet.has(item.filePath))

  relativeSnippetFiles.forEach((filePath) => {
    const knownSnippet = state.snippets.find(
      item => item.filePath === filePath,
    )
    if (knownSnippet) {
      return
    }

    const snippetAbsolutePath = path.join(paths.vaultPath, filePath)
    let snippetId = readFrontmatterIdFromSnippetFile(snippetAbsolutePath)

    if (!snippetId || existingIdSet.has(snippetId)) {
      snippetId = state.counters.snippetId + 1
      state.counters.snippetId = snippetId
    }

    existingIdSet.add(snippetId)
    state.snippets.push({ filePath, id: snippetId })
  })

  const snippets = loadSnippets(paths, state)
  syncCounters(state, snippets)
  syncFolderMetadataFiles(paths, state)
  saveState(paths, state, { immediate: true })

  return state
}

function setRuntimeCache(
  paths: Paths,
  state: MarkdownState,
  snippets: MarkdownSnippet[],
): MarkdownRuntimeCache {
  const folderById = new Map<number, FolderRecord>()
  state.folders.forEach(folder => folderById.set(folder.id, folder))

  const snippetById = new Map<number, MarkdownSnippet>()
  const contentOwnerByContentId = new Map<
    number,
    {
      contentIndex: number
      snippet: MarkdownSnippet
    }
  >()

  snippets.forEach((snippet) => {
    snippetById.set(snippet.id, snippet)

    snippet.contents.forEach((content, contentIndex) => {
      contentOwnerByContentId.set(content.id, {
        contentIndex,
        snippet,
      })
    })
  })

  const {
    searchSnippetTextById,
    searchTokenToSnippetIds,
    searchTokensBySnippetId,
  } = buildSearchIndex(snippets)

  markdownRuntimeCache = {
    contentOwnerByContentId,
    folderById,
    paths,
    searchIndexDirty: false,
    searchQueryCache: new Map(),
    searchSnippetTextById,
    searchTokenToSnippetIds,
    searchTokensBySnippetId,
    snippetById,
    snippets,
    state,
  }

  return markdownRuntimeCache
}

function areFolderRecordsEqual(
  previousFolders: FolderRecord[],
  nextFolders: FolderRecord[],
): boolean {
  if (previousFolders.length !== nextFolders.length) {
    return false
  }

  for (let index = 0; index < previousFolders.length; index += 1) {
    const previousFolder = previousFolders[index]
    const nextFolder = nextFolders[index]

    if (
      previousFolder.id !== nextFolder.id
      || previousFolder.name !== nextFolder.name
      || previousFolder.parentId !== nextFolder.parentId
      || previousFolder.defaultLanguage !== nextFolder.defaultLanguage
      || previousFolder.icon !== nextFolder.icon
      || previousFolder.isOpen !== nextFolder.isOpen
      || previousFolder.orderIndex !== nextFolder.orderIndex
      || previousFolder.createdAt !== nextFolder.createdAt
      || previousFolder.updatedAt !== nextFolder.updatedAt
    ) {
      return false
    }
  }

  return true
}

function areTagsEqual(
  previousTags: MarkdownTagState[],
  nextTags: MarkdownTagState[],
): boolean {
  if (previousTags.length !== nextTags.length) {
    return false
  }

  for (let index = 0; index < previousTags.length; index += 1) {
    const previousTag = previousTags[index]
    const nextTag = nextTags[index]

    if (
      previousTag.id !== nextTag.id
      || previousTag.name !== nextTag.name
      || previousTag.createdAt !== nextTag.createdAt
      || previousTag.updatedAt !== nextTag.updatedAt
    ) {
      return false
    }
  }

  return true
}

function areSnippetIndexItemsEqual(
  previousItems: MarkdownSnippetIndexItem[],
  nextItems: MarkdownSnippetIndexItem[],
): boolean {
  if (previousItems.length !== nextItems.length) {
    return false
  }

  for (let index = 0; index < previousItems.length; index += 1) {
    const previousItem = previousItems[index]
    const nextItem = nextItems[index]

    if (
      previousItem.id !== nextItem.id
      || previousItem.filePath !== nextItem.filePath
    ) {
      return false
    }
  }

  return true
}

function areStatesEqual(
  previousState: MarkdownState,
  nextState: MarkdownState,
): boolean {
  if (
    previousState.counters.contentId !== nextState.counters.contentId
    || previousState.counters.folderId !== nextState.counters.folderId
    || previousState.counters.snippetId !== nextState.counters.snippetId
    || previousState.counters.tagId !== nextState.counters.tagId
    || previousState.version !== nextState.version
  ) {
    return false
  }

  if (!areFolderRecordsEqual(previousState.folders, nextState.folders)) {
    return false
  }

  if (!areSnippetIndexItemsEqual(previousState.snippets, nextState.snippets)) {
    return false
  }

  if (!areTagsEqual(previousState.tags, nextState.tags)) {
    return false
  }

  return true
}

function areSnippetContentsEqual(
  previousSnippet: MarkdownSnippet,
  nextSnippet: MarkdownSnippet,
): boolean {
  if (previousSnippet.contents.length !== nextSnippet.contents.length) {
    return false
  }

  for (let index = 0; index < previousSnippet.contents.length; index += 1) {
    const previousContent = previousSnippet.contents[index]
    const nextContent = nextSnippet.contents[index]

    if (
      previousContent.id !== nextContent.id
      || previousContent.label !== nextContent.label
      || previousContent.language !== nextContent.language
      || previousContent.value !== nextContent.value
    ) {
      return false
    }
  }

  return true
}

function areSnippetsEqual(
  previousSnippets: MarkdownSnippet[],
  nextSnippets: MarkdownSnippet[],
): boolean {
  if (previousSnippets.length !== nextSnippets.length) {
    return false
  }

  for (let index = 0; index < previousSnippets.length; index += 1) {
    const previousSnippet = previousSnippets[index]
    const nextSnippet = nextSnippets[index]

    if (
      previousSnippet.id !== nextSnippet.id
      || previousSnippet.filePath !== nextSnippet.filePath
      || previousSnippet.name !== nextSnippet.name
      || previousSnippet.description !== nextSnippet.description
      || previousSnippet.folderId !== nextSnippet.folderId
      || previousSnippet.isDeleted !== nextSnippet.isDeleted
      || previousSnippet.isFavorites !== nextSnippet.isFavorites
      || previousSnippet.createdAt !== nextSnippet.createdAt
      || previousSnippet.updatedAt !== nextSnippet.updatedAt
    ) {
      return false
    }

    if (previousSnippet.tags.length !== nextSnippet.tags.length) {
      return false
    }

    for (
      let tagIndex = 0;
      tagIndex < previousSnippet.tags.length;
      tagIndex += 1
    ) {
      if (previousSnippet.tags[tagIndex] !== nextSnippet.tags[tagIndex]) {
        return false
      }
    }

    if (!areSnippetContentsEqual(previousSnippet, nextSnippet)) {
      return false
    }
  }

  return true
}

function areRuntimeCachesEqual(
  previousCache: MarkdownRuntimeCache,
  nextCache: MarkdownRuntimeCache,
): boolean {
  if (previousCache.paths.vaultPath !== nextCache.paths.vaultPath) {
    return false
  }

  if (!areStatesEqual(previousCache.state, nextCache.state)) {
    return false
  }

  return areSnippetsEqual(previousCache.snippets, nextCache.snippets)
}

function getStateSnippetIndexByFilePath(
  state: MarkdownState,
  filePath: string,
): number {
  const normalizedFilePath = filePath.toLowerCase()

  return state.snippets.findIndex(
    item => item.filePath.toLowerCase() === normalizedFilePath,
  )
}

function syncSnippetFileWithDisk(
  paths: Paths,
  changedFilePath: string,
): MarkdownRuntimeCache | null {
  if (
    !markdownRuntimeCache
    || markdownRuntimeCache.paths.vaultPath !== paths.vaultPath
  ) {
    return null
  }

  const normalizedFilePath = toPosixPath(changedFilePath).trim()
  if (
    !normalizedFilePath
    || path.posix.extname(normalizedFilePath).toLowerCase() !== '.md'
  ) {
    return null
  }

  const state = markdownRuntimeCache.state
  const snippets = markdownRuntimeCache.snippets
  const snippetAbsolutePath = path.join(paths.vaultPath, normalizedFilePath)
  const normalizedFileDirectory = normalizeDirectoryPath(
    path.posix.dirname(normalizedFilePath),
  )
  const pathToFolderIdMap = buildPathToFolderIdMap(state)

  if (
    !isInboxSnippetDirectory(normalizedFileDirectory)
    && !isTrashSnippetDirectory(normalizedFileDirectory)
    && normalizedFileDirectory
    && !pathToFolderIdMap.has(normalizedFileDirectory)
  ) {
    return null
  }

  const snippetIndexInState = getStateSnippetIndexByFilePath(
    state,
    normalizedFilePath,
  )
  const snippetExistsOnDisk = fs.pathExistsSync(snippetAbsolutePath)

  if (!snippetExistsOnDisk) {
    if (snippetIndexInState === -1) {
      return markdownRuntimeCache
    }

    const removedSnippetId = state.snippets[snippetIndexInState].id
    state.snippets.splice(snippetIndexInState, 1)

    const snippetIndexInRuntime = snippets.findIndex(
      snippet => snippet.id === removedSnippetId,
    )
    if (snippetIndexInRuntime !== -1) {
      snippets.splice(snippetIndexInRuntime, 1)
    }

    saveState(paths, state)
    return setRuntimeCache(paths, state, snippets)
  }

  let snippetIndexItem
    = snippetIndexInState !== -1 ? state.snippets[snippetIndexInState] : null

  if (!snippetIndexItem) {
    const existingSnippetIds = new Set<number>(
      state.snippets.map(item => item.id),
    )
    let snippetId = readFrontmatterIdFromSnippetFile(snippetAbsolutePath)

    if (!snippetId || existingSnippetIds.has(snippetId)) {
      snippetId = state.counters.snippetId + 1
      state.counters.snippetId = snippetId
    }

    snippetIndexItem = {
      filePath: normalizedFilePath,
      id: snippetId,
    }
    state.snippets.push(snippetIndexItem)
  }
  else {
    snippetIndexItem.filePath = normalizedFilePath
  }

  const syncedSnippet = readSnippetFromFile(
    paths,
    snippetIndexItem,
    pathToFolderIdMap,
  )

  if (!syncedSnippet) {
    return null
  }

  const snippetIndexInRuntime = snippets.findIndex(
    snippet => snippet.id === syncedSnippet.id,
  )
  if (snippetIndexInRuntime === -1) {
    snippets.push(syncedSnippet)
  }
  else {
    snippets[snippetIndexInRuntime] = syncedSnippet
  }

  const maxSnippetContentId = syncedSnippet.contents.reduce(
    (maxId, content) => Math.max(maxId, content.id),
    0,
  )
  state.counters.snippetId = Math.max(
    state.counters.snippetId,
    syncedSnippet.id,
  )
  state.counters.contentId = Math.max(
    state.counters.contentId,
    maxSnippetContentId,
  )

  saveState(paths, state)

  return setRuntimeCache(paths, state, snippets)
}

function syncRuntimeWithDisk(paths: Paths): MarkdownRuntimeCache {
  const state = syncStateWithDisk(paths)
  const snippets = loadSnippets(paths, state)

  return setRuntimeCache(paths, state, snippets)
}

function getRuntimeCache(paths: Paths): MarkdownRuntimeCache {
  if (
    !markdownRuntimeCache
    || markdownRuntimeCache.paths.vaultPath !== paths.vaultPath
  ) {
    return syncRuntimeWithDisk(paths)
  }

  return markdownRuntimeCache
}

function resetRuntimeCache(): void {
  flushPendingStateWrites()
  markdownRuntimeCache = null
}

function peekRuntimeCache(): MarkdownRuntimeCache | null {
  return markdownRuntimeCache
}

function serializeSnippet(snippet: MarkdownSnippet): string {
  const frontmatter: MarkdownSnippetFrontmatter = {
    contents: snippet.contents.map(content => ({
      id: content.id,
      label: content.label,
      language: content.language,
    })),
    createdAt: snippet.createdAt,
    description: snippet.description,
    folderId: snippet.folderId,
    id: snippet.id,
    isDeleted: snippet.isDeleted,
    isFavorites: snippet.isFavorites,
    name: snippet.name,
    tags: snippet.tags,
    updatedAt: snippet.updatedAt,
  }

  const frontmatterText = yaml
    .dump(frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  const body = snippet.contents
    .map((content) => {
      const label = content.label.replace(/\r?\n/g, ' ').trim() || 'Fragment'
      const language = content.language.trim() || 'plain_text'
      const value = content.value || ''

      return `## Fragment: ${label}\n\
\`\`\`${language}\n${value}\n\`\`\``
    })
    .join('\n\n')

  if (!body) {
    return `---\n${frontmatterText}\n---\n`
  }

  return `---\n${frontmatterText}\n---\n\n${body}\n`
}

function writeSnippetToFile(paths: Paths, snippet: MarkdownSnippet): void {
  const snippetPath = path.join(paths.vaultPath, snippet.filePath)
  const nextContent = serializeSnippet(snippet)

  fs.ensureDirSync(path.dirname(snippetPath))

  if (fs.pathExistsSync(snippetPath)) {
    const currentContent = fs.readFileSync(snippetPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.writeFileSync(snippetPath, nextContent, 'utf8')
}

function upsertSnippetIndex(
  state: MarkdownState,
  snippet: MarkdownSnippet,
): void {
  const index = state.snippets.findIndex(item => item.id === snippet.id)

  if (index === -1) {
    state.snippets.push({
      filePath: snippet.filePath,
      id: snippet.id,
    })
    return
  }

  state.snippets[index].filePath = snippet.filePath
}

function getSnippetTargetDirectory(
  state: MarkdownState,
  snippet: Pick<MarkdownSnippet, 'folderId' | 'isDeleted'>,
): string {
  if (snippet.isDeleted === 1) {
    return TRASH_RELATIVE_PATH
  }

  if (snippet.folderId === null) {
    return INBOX_RELATIVE_PATH
  }

  const folderPath = getFolderPathById(state, snippet.folderId)
  return folderPath || INBOX_RELATIVE_PATH
}

function buildSnippetTargetPath(
  state: MarkdownState,
  snippet: MarkdownSnippet,
): string {
  const directory = getSnippetTargetDirectory(state, snippet)
  const fileName = toSnippetFileName(snippet.name)

  return directory ? path.posix.join(directory, fileName) : fileName
}

type DirectoryEntriesCache = Map<string, string[]>

function getCachedDirectoryEntries(
  directoryPath: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): string[] {
  if (!directoryEntriesCache) {
    return fs.readdirSync(directoryPath)
  }

  const cachedEntries = directoryEntriesCache.get(directoryPath)
  if (cachedEntries) {
    return cachedEntries
  }

  const entries = fs.readdirSync(directoryPath)
  directoryEntriesCache.set(directoryPath, [...entries])
  return entries
}

function removeDirectoryEntryFromCache(
  directoryPath: string,
  fileName: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  if (!directoryEntriesCache) {
    return
  }

  const entries = directoryEntriesCache.get(directoryPath)
  if (!entries) {
    return
  }

  const normalizedFileName = fileName.toLowerCase()
  const nextEntries = entries.filter(
    entry => entry.toLowerCase() !== normalizedFileName,
  )

  directoryEntriesCache.set(directoryPath, nextEntries)
}

function upsertDirectoryEntryInCache(
  directoryPath: string,
  fileName: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  if (!directoryEntriesCache) {
    return
  }

  const entries
    = directoryEntriesCache.get(directoryPath) || fs.readdirSync(directoryPath)
  const normalizedFileName = fileName.toLowerCase()
  const nextEntries = entries.filter(
    entry => entry.toLowerCase() !== normalizedFileName,
  )

  nextEntries.push(fileName)
  directoryEntriesCache.set(directoryPath, nextEntries)
}

function assertSnippetPathAvailable(
  paths: Paths,
  targetRelativePath: string,
  excludeRelativePath?: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  const targetAbsolutePath = path.join(paths.vaultPath, targetRelativePath)
  const targetDirectory = path.dirname(targetAbsolutePath)
  const targetFileName = path.basename(targetAbsolutePath)
  const excludeAbsolutePath = excludeRelativePath
    ? path.join(paths.vaultPath, excludeRelativePath)
    : null

  fs.ensureDirSync(targetDirectory)

  const entries = getCachedDirectoryEntries(
    targetDirectory,
    directoryEntriesCache,
  )
  for (const entry of entries) {
    const entryAbsolutePath = path.join(targetDirectory, entry)

    if (excludeAbsolutePath && entryAbsolutePath === excludeAbsolutePath) {
      continue
    }

    if (entry.toLowerCase() === targetFileName.toLowerCase()) {
      throwStorageError(
        'NAME_CONFLICT',
        'Snippet with this name already exists on this level',
      )
    }
  }
}

function getUniqueSnippetPath(
  paths: Paths,
  targetRelativePath: string,
  excludeRelativePath?: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): string {
  const targetAbsolutePath = path.join(paths.vaultPath, targetRelativePath)
  const targetDirectory = path.dirname(targetAbsolutePath)
  const targetFileName = path.basename(targetAbsolutePath)
  const excludeAbsolutePath = excludeRelativePath
    ? path.join(paths.vaultPath, excludeRelativePath)
    : null

  fs.ensureDirSync(targetDirectory)

  const entries = getCachedDirectoryEntries(
    targetDirectory,
    directoryEntriesCache,
  )
  const hasCaseInsensitiveConflict = (candidateFileName: string): boolean => {
    return entries.some((entry) => {
      const entryAbsolutePath = path.join(targetDirectory, entry)

      if (excludeAbsolutePath && entryAbsolutePath === excludeAbsolutePath) {
        return false
      }

      return entry.toLowerCase() === candidateFileName.toLowerCase()
    })
  }

  if (!hasCaseInsensitiveConflict(targetFileName)) {
    return targetRelativePath
  }

  const extension = path.extname(targetFileName)
  const baseName = extension
    ? targetFileName.slice(0, -extension.length)
    : targetFileName
  const parentDirectory = normalizeDirectoryPath(
    path.posix.dirname(targetRelativePath),
  )

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidateFileName = `${baseName} ${suffix}${extension}`
    if (!hasCaseInsensitiveConflict(candidateFileName)) {
      return parentDirectory
        ? path.posix.join(parentDirectory, candidateFileName)
        : candidateFileName
    }
  }

  throwStorageError(
    'NAME_CONFLICT',
    'Cannot generate unique snippet name in this directory',
  )
}

export interface PersistSnippetOptions {
  allowRenameOnConflict?: boolean
  directoryEntriesCache?: Map<string, string[]>
}

function persistSnippet(
  paths: Paths,
  state: MarkdownState,
  snippet: MarkdownSnippet,
  previousFilePath?: string,
  options?: PersistSnippetOptions,
): void {
  let targetPath = buildSnippetTargetPath(state, snippet)
  const sourcePath = previousFilePath ?? snippet.filePath
  const directoryEntriesCache = options?.directoryEntriesCache

  if (options?.allowRenameOnConflict) {
    targetPath = getUniqueSnippetPath(
      paths,
      targetPath,
      sourcePath,
      directoryEntriesCache,
    )
    snippet.name = path.posix.basename(targetPath, '.md')
  }
  else {
    assertSnippetPathAvailable(
      paths,
      targetPath,
      sourcePath,
      directoryEntriesCache,
    )
  }

  const sourceAbsolutePath = sourcePath
    ? path.join(paths.vaultPath, sourcePath)
    : null
  const targetAbsolutePath = path.join(paths.vaultPath, targetPath)

  if (
    sourceAbsolutePath
    && sourcePath
    && sourcePath !== targetPath
    && fs.pathExistsSync(sourceAbsolutePath)
  ) {
    fs.ensureDirSync(path.dirname(targetAbsolutePath))
    fs.moveSync(sourceAbsolutePath, targetAbsolutePath, { overwrite: false })

    removeDirectoryEntryFromCache(
      path.dirname(sourceAbsolutePath),
      path.basename(sourceAbsolutePath),
      directoryEntriesCache,
    )
  }

  snippet.filePath = targetPath
  writeSnippetToFile(paths, snippet)
  upsertDirectoryEntryInCache(
    path.dirname(targetAbsolutePath),
    path.basename(targetAbsolutePath),
    directoryEntriesCache,
  )
  upsertSnippetIndex(state, snippet)
}

function createSnippetRecord(
  snippet: MarkdownSnippet,
  state: MarkdownState,
): SnippetRecord {
  const folder
    = snippet.folderId !== null
      ? findFolderById(state, snippet.folderId)
      : undefined

  const tags = snippet.tags
    .map((tagId) => {
      const tag = state.tags.find(item => item.id === tagId)

      if (!tag) {
        return null
      }

      return {
        id: tag.id,
        name: tag.name,
      }
    })
    .filter((tag): tag is { id: number, name: string } => !!tag)

  return {
    contents: snippet.contents,
    createdAt: snippet.createdAt,
    description: snippet.description,
    folder: folder
      ? {
          id: folder.id,
          name: folder.name,
        }
      : null,
    id: snippet.id,
    isDeleted: snippet.isDeleted,
    isFavorites: snippet.isFavorites,
    name: snippet.name,
    tags,
    updatedAt: snippet.updatedAt,
  }
}

function findSnippetById(
  snippets: MarkdownSnippet[],
  id: number,
): MarkdownSnippet | undefined {
  const runtimeCache
    = markdownRuntimeCache?.snippets === snippets ? markdownRuntimeCache : null

  if (runtimeCache) {
    if (runtimeCache.snippetById.size !== snippets.length) {
      runtimeCache.snippetById = new Map(
        snippets.map(snippet => [snippet.id, snippet]),
      )
    }

    const snippetFromIndex = runtimeCache.snippetById.get(id)
    if (snippetFromIndex) {
      return snippetFromIndex
    }
  }

  const snippet = snippets.find(item => item.id === id)
  if (snippet && runtimeCache) {
    runtimeCache.snippetById.set(id, snippet)
  }

  return snippet
}

function findSnippetByContentId(
  snippets: MarkdownSnippet[],
  contentId: number,
): {
  contentIndex: number
  snippet: MarkdownSnippet
} | null {
  const runtimeCache
    = markdownRuntimeCache?.snippets === snippets ? markdownRuntimeCache : null

  if (runtimeCache) {
    const indexedOwner = runtimeCache.contentOwnerByContentId.get(contentId)
    if (
      indexedOwner
      && indexedOwner.snippet.contents[indexedOwner.contentIndex]?.id === contentId
    ) {
      return indexedOwner
    }
  }

  for (const snippet of snippets) {
    const contentIndex = snippet.contents.findIndex(
      content => content.id === contentId,
    )

    if (contentIndex !== -1) {
      const ownedContent = {
        contentIndex,
        snippet,
      }

      if (runtimeCache) {
        runtimeCache.contentOwnerByContentId.set(contentId, ownedContent)
      }

      return ownedContent
    }
  }

  if (runtimeCache) {
    runtimeCache.contentOwnerByContentId.delete(contentId)
  }

  return null
}

export function getMarkdownStorageErrorMessage(error: unknown): string {
  return normalizeErrorMessage(error)
}

export {
  areRuntimeCachesEqual,
  assertDirectoryNameAvailable,
  assertNotReservedRootFolderName,
  assertUniqueSiblingFolderName,
  buildFolderPathMap,
  buildSnippetTargetPath,
  createDefaultState,
  createSnippetRecord,
  depthOfRelativePath,
  ensureStateFile,
  findFolderById,
  findSnippetByContentId,
  findSnippetById,
  getFolderPathById,
  getNextFolderOrder,
  getPaths,
  getRuntimeCache,
  getSnippetIdsBySearchQuery,
  getSnippetTargetDirectory,
  getVaultPath,
  loadSnippets,
  normalizeDirectoryPath,
  normalizeFlag,
  peekRuntimeCache,
  persistSnippet,
  resetRuntimeCache,
  resolveUniqueSiblingFolderName,
  saveState,
  setRuntimeCache,
  syncCounters,
  syncFolderMetadataFiles,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
  syncStateWithDisk,
  throwStorageError,
  validateEntryName,
  writeSnippetToFile,
}
