import type {
  VaultDoctorInput,
  VaultDoctorItem,
  VaultDoctorResponse,
  VaultDoctorWarning,
} from '../../../api/dto/vault-doctor'
import type { MathNotebookStore, MathSheet } from '../../../store/types'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { enqueueCloudDownload } from './cloudDownloads'
import {
  getHttpPaths,
  isHttpVaultDiskReady,
  loadHttpState,
  syncHttpRuntimeWithDisk,
} from './http/runtime'
import {
  getNotesPaths,
  isNotesVaultDiskReady,
  loadNotesState,
  syncNotesRuntimeWithDisk,
} from './notes/runtime'
import {
  getPaths,
  getSpaceStatePath,
  getVaultPath,
  INBOX_DIR_NAME,
  isCodeVaultDiskReady,
  loadState,
  META_DIR_NAME,
  META_FILE_NAME,
  readSpaceState,
  syncRuntimeWithDisk,
  TRASH_DIR_NAME,
  writeSpaceStateImmediate,
} from './runtime'
import {
  getFileAvailability,
  primeDatalessChecks,
} from './runtime/shared/cloudFiles'
import { isCloudFileNotDownloadedError } from './runtime/shared/guardedRead'

type VaultDoctorSpace = NonNullable<VaultDoctorInput['spaces']>[number]

interface Fingerprint {
  mtimeMs: number
  path: string
  size: number
}

interface ScanContext {
  conflictGroups: VaultDoctorResponse['conflictGroups']
  items: VaultDoctorItem[]
  warnings: VaultDoctorWarning[]
}

interface EntityScanRecord {
  filePath: string
  fingerprint: Fingerprint
  // folderId из frontmatter: у заметок он приоритетнее пути и может
  // указывать на несуществующую папку (dangling).
  folderId: number | null
  id: number
  kind: 'note' | 'snippet'
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>
}

const DEFAULT_SPACES: VaultDoctorSpace[] = ['code', 'notes', 'http', 'math']
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const MERGE_MARKER_RE = /^(?:<<<<<<<(?: .*)?|=======|>>>>>>>(?: .*)?)$/m
const CONFLICTED_NAME_RE
  = /\b(?:conflict|conflicted|conflicted copy|copy conflict)\b|\([^)]+(?:macbook|machine|conflict|conflicted)[^)]*\)/i
const FRONTMATTER_ID_RE = /^id:.*$/m
const INBOX_RELATIVE_PATH = `${META_DIR_NAME}/${INBOX_DIR_NAME}`
const TRASH_RELATIVE_PATH = `${META_DIR_NAME}/${TRASH_DIR_NAME}`

function normalizeSpaces(input?: VaultDoctorInput): VaultDoctorSpace[] {
  const requestedSpaces = input?.spaces?.length ? input.spaces : DEFAULT_SPACES
  return [...new Set(requestedSpaces)]
}

function toPosixPath(value: string): string {
  return value.replaceAll(path.sep, '/')
}

function getFingerprint(absolutePath: string): Fingerprint {
  try {
    const stat = fs.statSync(absolutePath)
    return {
      mtimeMs: stat.mtimeMs,
      path: absolutePath,
      size: stat.size,
    }
  }
  catch {
    return {
      mtimeMs: 0,
      path: absolutePath,
      size: 0,
    }
  }
}

function isInsideRelativePath(value: string, parentPath: string): boolean {
  return value === parentPath || value.startsWith(`${parentPath}/`)
}

function shouldSkipMarkdownDirectory(relativePath: string): boolean {
  if (isInsideRelativePath(relativePath, TRASH_RELATIVE_PATH)) {
    return true
  }

  if (
    relativePath.startsWith(`${META_DIR_NAME}/`)
    && !isInsideRelativePath(relativePath, INBOX_RELATIVE_PATH)
  ) {
    return true
  }

  const name = path.posix.basename(relativePath)
  return name.startsWith('.') && name !== META_DIR_NAME
}

function addItem(context: ScanContext, item: VaultDoctorItem): void {
  context.items.push(item)
}

function addWarning(context: ScanContext, warning: VaultDoctorWarning): void {
  context.warnings.push(warning)
}

function createFileItem(input: {
  action: VaultDoctorItem['action']
  absolutePath: string
  kind: VaultDoctorItem['kind']
  relativePath: string
  space: VaultDoctorSpace
  status: VaultDoctorItem['status']
}): VaultDoctorItem {
  return {
    action: input.action,
    fingerprint: getFingerprint(input.absolutePath),
    kind: input.kind,
    path: input.relativePath,
    space: input.space,
    status: input.status,
  }
}

function listMarkdownFiles(rootPath: string): string[] {
  const files: string[] = []

  function walk(currentPath: string): void {
    if (!fs.pathExistsSync(currentPath)) {
      return
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== META_DIR_NAME) {
        continue
      }

      const absolutePath = path.join(currentPath, entry.name)
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))

      if (entry.isDirectory()) {
        if (shouldSkipMarkdownDirectory(relativePath)) {
          continue
        }

        walk(absolutePath)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(relativePath)
      }
    }
  }

  walk(rootPath)
  return files
}

function listFolders(
  rootPath: string,
  skipRootNames = new Set<string>(),
): string[] {
  const folders: string[] = []

  function walk(currentPath: string): void {
    if (!fs.pathExistsSync(currentPath)) {
      return
    }

    const isRoot = currentPath === rootPath
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      if (
        entry.name.startsWith('.')
        || (isRoot && skipRootNames.has(entry.name))
      ) {
        continue
      }

      const absolutePath = path.join(currentPath, entry.name)
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))
      folders.push(relativePath)
      walk(absolutePath)
    }
  }

  walk(rootPath)
  return folders
}

function readFrontmatter(source: string): {
  frontmatter: Record<string, unknown>
  hasFrontmatter: boolean
  invalid: boolean
} {
  const match = source.match(FRONTMATTER_RE)
  if (!match) {
    return {
      frontmatter: {},
      hasFrontmatter: false,
      invalid: false,
    }
  }

  try {
    const parsed = yaml.load(match[1])
    return {
      frontmatter:
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {},
      hasFrontmatter: true,
      invalid: false,
    }
  }
  catch {
    return {
      frontmatter: {},
      hasFrontmatter: true,
      invalid: true,
    }
  }
}

function normalizeId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function inspectMarkdownEntity(input: {
  context: ScanContext
  filePath: string
  kind: EntityScanRecord['kind']
  rootPath: string
  space: EntityScanRecord['space']
}): EntityScanRecord | null {
  const absolutePath = path.join(input.rootPath, input.filePath)

  // Недокачанный облачный файл нельзя аудировать без блокирующего чтения:
  // он уходит в фоновую докачку и пропускается в этом прогоне Doctor.
  if (getFileAvailability(absolutePath).isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    return null
  }

  let source: string
  try {
    source = fs.readFileSync(absolutePath, 'utf8')
  }
  catch {
    enqueueCloudDownload(absolutePath)
    return null
  }

  const fileName = path.basename(input.filePath)
  const fingerprint = getFingerprint(absolutePath)

  if (MERGE_MARKER_RE.test(source)) {
    addItem(input.context, {
      action: 'detect-conflict',
      fingerprint,
      kind: 'conflict',
      path: input.filePath,
      space: input.space,
      status: 'blocked',
    })
    input.context.conflictGroups.push({
      id: `${input.space}:merge-markers:${input.filePath}`,
      items: [input.context.items[input.context.items.length - 1]],
      reason: 'merge-markers',
    })
    return null
  }

  if (CONFLICTED_NAME_RE.test(fileName)) {
    addWarning(input.context, {
      code: 'CONFLICTED_COPY_NAME',
      path: input.filePath,
      space: input.space,
    })
  }

  const parsed = readFrontmatter(source)
  if (parsed.invalid) {
    addItem(input.context, {
      action: 'detect-conflict',
      fingerprint,
      kind: 'conflict',
      path: input.filePath,
      space: input.space,
      status: 'blocked',
    })
    input.context.conflictGroups.push({
      id: `${input.space}:invalid-frontmatter:${input.filePath}`,
      items: [input.context.items[input.context.items.length - 1]],
      reason: 'invalid-frontmatter',
    })
    return null
  }

  const id = normalizeId(parsed.frontmatter.id)
  if (!parsed.hasFrontmatter || !id) {
    addItem(input.context, {
      action: parsed.hasFrontmatter ? 'register-file' : 'write-frontmatter',
      fingerprint,
      kind: input.kind,
      path: input.filePath,
      space: input.space,
      status: 'pending',
    })
  }

  return id
    ? {
        filePath: input.filePath,
        fingerprint,
        folderId: normalizeId(parsed.frontmatter.folderId),
        id,
        kind: input.kind,
        space: input.space,
      }
    : null
}

function collectDuplicateIds(
  context: ScanContext,
  records: EntityScanRecord[],
): void {
  const recordsByKey = new Map<string, EntityScanRecord[]>()

  records.forEach((record) => {
    const key = `${record.space}:${record.kind}:${record.id}`
    recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), record])
  })

  recordsByKey.forEach((group, key) => {
    if (group.length < 2) {
      return
    }

    const items = group.map(
      record =>
        ({
          action: 'reassign-id',
          fingerprint: record.fingerprint,
          kind: record.kind,
          path: record.filePath,
          space: record.space,
          status: 'needs-decision',
        }) satisfies VaultDoctorItem,
    )

    context.items.push(...items)
    context.conflictGroups.push({
      id: key,
      items,
      reason: 'duplicate-id',
    })
  })
}

function getSpaceRoot(
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>,
): string {
  const vaultPath = getVaultPath()

  if (space === 'code') {
    return getPaths(vaultPath).vaultPath
  }

  if (space === 'notes') {
    return getNotesPaths(vaultPath).notesRoot
  }

  return getHttpPaths(vaultPath).httpRoot
}

function getStateIds(
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>,
): number[] {
  const vaultPath = getVaultPath()

  if (space === 'code') {
    return loadState(getPaths(vaultPath)).snippets.map(item => item.id)
  }

  if (space === 'notes') {
    return loadNotesState(getNotesPaths(vaultPath)).notes.map(
      item => item.id,
    )
  }

  return loadHttpState(getHttpPaths(vaultPath)).requests.map(item => item.id)
}

function getStateIndexedFilePaths(
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>,
): Set<string> {
  const vaultPath = getVaultPath()

  const filePaths
    = space === 'code'
      ? loadState(getPaths(vaultPath)).snippets.map(item => item.filePath)
      : space === 'notes'
        ? loadNotesState(getNotesPaths(vaultPath)).notes.map(
            item => item.filePath,
          )
        : loadHttpState(getHttpPaths(vaultPath)).requests.map(
            item => item.filePath,
          )

  return new Set(filePaths.map(filePath => filePath.toLowerCase()))
}

// Файл с валидным frontmatter-id, которого нет в state-индексе, приложение
// не отображает до полного пересканирования: Doctor предлагает регистрацию
// (apply выполняет пересинк пространства, который заберёт файл в индекс).
function collectUnindexedFiles(
  context: ScanContext,
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>,
  records: EntityScanRecord[],
): void {
  const indexedFilePaths = getStateIndexedFilePaths(space)

  for (const record of records) {
    if (!indexedFilePaths.has(record.filePath.toLowerCase())) {
      addItem(context, {
        action: 'register-file',
        fingerprint: record.fingerprint,
        kind: record.kind,
        path: record.filePath,
        space,
        status: 'pending',
      })
    }
  }
}

function getNextEntityId(
  space: Extract<VaultDoctorSpace, 'code' | 'http' | 'notes'>,
): () => number {
  const rootPath = getSpaceRoot(space)
  const ids = new Set<number>(getStateIds(space))

  listMarkdownFiles(rootPath).forEach((filePath) => {
    try {
      const absolutePath = path.join(rootPath, filePath)

      // Недокачанный файл пропускается: его чтение заблокировало бы main
      // process, а id из него в этот прогон всё равно не получить.
      if (getFileAvailability(absolutePath).isCloudPlaceholder) {
        return
      }

      const source = fs.readFileSync(absolutePath, 'utf8')
      const parsed = readFrontmatter(source)
      const id = normalizeId(parsed.frontmatter.id)
      if (id) {
        ids.add(id)
      }
    }
    catch {
      // Ignore unreadable files; preview will report them separately.
    }
  })

  let nextId = Math.max(0, ...ids) + 1
  return () => {
    const id = nextId
    nextId += 1
    return id
  }
}

function isFingerprintCurrent(item: VaultDoctorItem): boolean {
  const current = getFingerprint(item.fingerprint.path)
  return (
    current.mtimeMs === item.fingerprint.mtimeMs
    && current.size === item.fingerprint.size
  )
}

function replaceFrontmatterId(source: string, id: number): string {
  const match = source.match(FRONTMATTER_RE)
  if (!match) {
    return source
  }

  const frontmatter = FRONTMATTER_ID_RE.test(match[1])
    ? match[1].replace(FRONTMATTER_ID_RE, `id: ${id}`)
    : `id: ${id}\n${match[1]}`

  return `---\n${frontmatter}\n---\n${match[2] || ''}`
}

function applyDuplicateIdDecisions(
  preview: VaultDoctorResponse,
  decisions: VaultDoctorInput['decisions'] = [],
): VaultDoctorItem[] {
  const appliedItems: VaultDoctorItem[] = []
  const decisionsByGroupId = new Map(
    decisions.map(decision => [decision.groupId, decision]),
  )

  preview.conflictGroups.forEach((group) => {
    if (group.reason !== 'duplicate-id') {
      return
    }

    const decision = decisionsByGroupId.get(group.id)
    if (!decision) {
      return
    }

    const keepItem = group.items.find(
      item => item.path === decision.keepPath,
    )
    if (!keepItem) {
      return
    }

    if (group.items.some(item => !isFingerprintCurrent(item))) {
      return
    }

    const space = keepItem.space as Extract<
      VaultDoctorSpace,
      'code' | 'http' | 'notes'
    >
    const nextId = getNextEntityId(space)

    group.items.forEach((item) => {
      if (item.path === decision.keepPath || item.status !== 'needs-decision') {
        return
      }

      const absolutePath = item.fingerprint.path

      // Недокачанный файл не переписывается: чтение заблокировало бы main
      // process, а запись затёрла бы облачное содержимое. Элемент остаётся
      // неприменённым, пользователь повторит после докачки.
      if (getFileAvailability(absolutePath).isCloudPlaceholder) {
        enqueueCloudDownload(absolutePath)
        return
      }

      const source = fs.readFileSync(absolutePath, 'utf8')
      fs.writeFileSync(
        absolutePath,
        replaceFrontmatterId(source, nextId()),
        'utf8',
      )
      appliedItems.push({
        ...item,
        status: 'applied',
      })
    })
  })

  return appliedItems
}

function scanCode(context: ScanContext): void {
  const paths = getPaths(getVaultPath())
  const records: EntityScanRecord[] = []
  const skipRootNames = new Set([META_DIR_NAME, 'inbox', TRASH_DIR_NAME])

  listFolders(paths.vaultPath, skipRootNames).forEach((folderPath) => {
    const metaPath = path.join(paths.vaultPath, folderPath, META_FILE_NAME)
    if (!fs.pathExistsSync(metaPath)) {
      addItem(
        context,
        createFileItem({
          action: 'create-folder-metadata',
          absolutePath: path.join(paths.vaultPath, folderPath),
          kind: 'folder',
          relativePath: folderPath,
          space: 'code',
          status: 'pending',
        }),
      )
    }
  })

  const snippetFiles = listMarkdownFiles(paths.vaultPath)
  primeDatalessChecks(
    snippetFiles.map(filePath => path.join(paths.vaultPath, filePath)),
  )

  snippetFiles.forEach((filePath) => {
    const record = inspectMarkdownEntity({
      context,
      filePath,
      kind: 'snippet',
      rootPath: paths.vaultPath,
      space: 'code',
    })
    if (record) {
      records.push(record)
    }
  })

  collectDuplicateIds(context, records)
  collectUnindexedFiles(context, 'code', records)
}

function readNotesFolderIdFromMetadata(metaPath: string): number | null {
  // Недокачанный .meta.yaml не читается синхронно: id папки в этот прогон
  // не получить, заметки этой папки не считаются dangling.
  if (getFileAvailability(metaPath).isCloudPlaceholder) {
    enqueueCloudDownload(metaPath)
    return null
  }

  try {
    const parsed = yaml.load(fs.readFileSync(metaPath, 'utf8')) as {
      id?: unknown
    } | null
    return normalizeId(parsed?.id)
  }
  catch {
    return null
  }
}

function scanNotes(context: ScanContext): void {
  const paths = getNotesPaths(getVaultPath())
  const records: EntityScanRecord[] = []
  const diskFolderIds = new Set<number>()
  let hasUnreadableFolderMetadata = false

  listFolders(paths.notesRoot).forEach((folderPath) => {
    const metaPath = path.join(paths.notesRoot, folderPath, META_FILE_NAME)
    if (!fs.pathExistsSync(metaPath)) {
      // Папка без метаданных получит id при следующем синке: судить о
      // dangling-ссылках в этот прогон нельзя.
      hasUnreadableFolderMetadata = true
      addItem(
        context,
        createFileItem({
          action: 'create-folder-metadata',
          absolutePath: path.join(paths.notesRoot, folderPath),
          kind: 'folder',
          relativePath: folderPath,
          space: 'notes',
          status: 'pending',
        }),
      )
      return
    }

    const folderId = readNotesFolderIdFromMetadata(metaPath)
    if (folderId) {
      diskFolderIds.add(folderId)
    }
    else {
      hasUnreadableFolderMetadata = true
    }
  })

  const noteFiles = listMarkdownFiles(paths.notesRoot)
  primeDatalessChecks(
    noteFiles.map(filePath => path.join(paths.notesRoot, filePath)),
  )

  noteFiles.forEach((filePath) => {
    const record = inspectMarkdownEntity({
      context,
      filePath,
      kind: 'note',
      rootPath: paths.notesRoot,
      space: 'notes',
    })
    if (record) {
      records.push(record)
    }
  })

  collectDuplicateIds(context, records)
  collectUnindexedFiles(context, 'notes', records)

  // folderId во frontmatter приоритетнее пути (см. readNoteFromFile):
  // ссылка на несуществующую папку делает заметку невидимой в дереве папок.
  if (!hasUnreadableFolderMetadata) {
    for (const record of records) {
      if (record.folderId && !diskFolderIds.has(record.folderId)) {
        addWarning(context, {
          code: 'DANGLING_FOLDER_ID',
          path: record.filePath,
          space: 'notes',
        })
      }
    }
  }
}

function scanHttp(context: ScanContext): void {
  const paths = getHttpPaths(getVaultPath())
  const records: EntityScanRecord[] = []
  const state = loadHttpState(paths)

  const httpFiles = listMarkdownFiles(paths.httpRoot)
  primeDatalessChecks(
    httpFiles.map(filePath => path.join(paths.httpRoot, filePath)),
  )

  httpFiles.forEach((filePath) => {
    const record = inspectMarkdownEntity({
      context,
      filePath,
      kind: 'snippet',
      rootPath: paths.httpRoot,
      space: 'http',
    })
    if (record) {
      records.push(record)
    }
  })

  const seenEnvironmentIds = new Set<number>()
  let hasEnvironmentRepair = false
  for (const environment of state.environments) {
    if (
      !Number.isInteger(environment.id)
      || environment.id <= 0
      || seenEnvironmentIds.has(environment.id)
      || !environment.variables
      || typeof environment.variables !== 'object'
    ) {
      hasEnvironmentRepair = true
    }
    if (Number.isInteger(environment.id) && environment.id > 0) {
      seenEnvironmentIds.add(environment.id)
    }
  }
  if (
    state.activeEnvironmentId !== null
    && !state.environments.some(env => env.id === state.activeEnvironmentId)
  ) {
    hasEnvironmentRepair = true
  }

  if (hasEnvironmentRepair) {
    addItem(context, {
      action: 'repair-environment-state',
      fingerprint: getFingerprint(paths.statePath),
      kind: 'environment',
      path: toPosixPath(path.relative(paths.httpRoot, paths.statePath)),
      space: 'http',
      status: 'pending',
    })
  }

  collectDuplicateIds(context, records)
  collectUnindexedFiles(context, 'http', records)
}

function normalizeMathSheet(
  sheet: Partial<MathSheet>,
  usedIds: Set<string>,
): { changed: boolean, sheet: MathSheet } {
  let changed = false
  let id = typeof sheet.id === 'string' && sheet.id ? sheet.id : randomUUID()
  if (usedIds.has(id)) {
    id = randomUUID()
    changed = true
  }
  usedIds.add(id)

  if (id !== sheet.id) {
    changed = true
  }

  const now = Date.now()
  const normalized: MathSheet = {
    content: typeof sheet.content === 'string' ? sheet.content : '',
    createdAt: typeof sheet.createdAt === 'number' ? sheet.createdAt : now,
    id,
    name:
      typeof sheet.name === 'string' && sheet.name.trim()
        ? sheet.name
        : 'Sheet',
    updatedAt: typeof sheet.updatedAt === 'number' ? sheet.updatedAt : now,
  }

  return {
    changed:
      changed
      || normalized.content !== sheet.content
      || normalized.createdAt !== sheet.createdAt
      || normalized.name !== sheet.name
      || normalized.updatedAt !== sheet.updatedAt,
    sheet: normalized,
  }
}

function getMathStatePath(): string {
  return getSpaceStatePath(getVaultPath(), 'math')
}

function readNormalizedMathState(): {
  changed: boolean
  state: MathNotebookStore
} {
  const statePath = getMathStatePath()
  const raw = readSpaceState<Partial<MathNotebookStore>>(statePath)
  const usedIds = new Set<string>()
  let changed = false
  const sheets: MathSheet[] = []

  if (!raw || !Array.isArray(raw.sheets)) {
    changed = !!raw
  }
  else {
    raw.sheets.forEach((sheet) => {
      if (!sheet || typeof sheet !== 'object') {
        changed = true
        return
      }

      const result = normalizeMathSheet(sheet, usedIds)
      if (result.changed) {
        changed = true
      }
      sheets.push(result.sheet)
    })
  }

  let activeSheetId
    = typeof raw?.activeSheetId === 'string' ? raw.activeSheetId : null
  if (activeSheetId && !sheets.some(sheet => sheet.id === activeSheetId)) {
    activeSheetId = sheets[0]?.id ?? null
    changed = true
  }

  return {
    changed,
    state: {
      activeSheetId,
      sheets,
    },
  }
}

function scanMath(context: ScanContext): void {
  const statePath = getMathStatePath()

  // math/.state.yaml может быть ещё не докачан из облака: аудит без
  // содержимого невозможен, пространство проверится после докачки.
  let changed: boolean
  try {
    changed = readNormalizedMathState().changed
  }
  catch (error) {
    if (isCloudFileNotDownloadedError(error)) {
      return
    }

    throw error
  }

  if (!changed) {
    return
  }

  addItem(context, {
    action: 'repair-math-state',
    fingerprint: getFingerprint(statePath),
    kind: 'math-sheet',
    path: 'math/.state.yaml',
    space: 'math',
    status: 'pending',
  })
}

function buildSummary(context: ScanContext): VaultDoctorResponse['summary'] {
  const items = context.items

  return {
    affectedFiles: items.filter(item => item.status === 'pending').length,
    blocked: items.filter(item => item.status === 'blocked').length,
    conflicts: context.conflictGroups.length,
    folders: items.filter(item => item.kind === 'folder').length,
    httpEnvironments: items.filter(item => item.kind === 'environment')
      .length,
    httpRequests: items.filter(item => item.space === 'http').length,
    mathSheets: items.filter(item => item.kind === 'math-sheet').length,
    notes: items.filter(item => item.kind === 'note').length,
    skipped: items.filter(item => item.status === 'skipped').length,
    snippets: items.filter(item => item.kind === 'snippet').length,
    warnings: context.warnings.length,
  }
}

function createContext(): ScanContext {
  return {
    conflictGroups: [],
    items: [],
    warnings: [],
  }
}

export function previewVaultDoctor(
  input?: VaultDoctorInput,
): VaultDoctorResponse {
  const context = createContext()
  const spaces = normalizeSpaces(input)

  // Пока vault не сверен с диском после открытия (каталоги могут быть
  // недокачаны из облака), полный аудит невозможен без блокирующего
  // обхода: возвращается пустой результат, Doctor запускается позже.
  const vaultRootPath = getVaultPath()
  if (
    !isCodeVaultDiskReady(getPaths(vaultRootPath))
    || !isNotesVaultDiskReady(getNotesPaths(vaultRootPath))
    || !isHttpVaultDiskReady(getHttpPaths(vaultRootPath))
  ) {
    return {
      conflictGroups: [],
      items: [],
      summary: buildSummary(context),
      warnings: [],
    }
  }

  if (spaces.includes('code')) {
    scanCode(context)
  }
  if (spaces.includes('notes')) {
    scanNotes(context)
  }
  if (spaces.includes('http')) {
    scanHttp(context)
  }
  if (spaces.includes('math')) {
    scanMath(context)
  }

  return {
    conflictGroups: context.conflictGroups,
    items: context.items,
    summary: buildSummary(context),
    warnings: context.warnings,
  }
}

function spacesWithConflicts(
  result: VaultDoctorResponse,
): Set<VaultDoctorSpace> {
  return new Set(
    result.items
      .filter(
        item => item.status === 'blocked' || item.status === 'needs-decision',
      )
      .map(item => item.space),
  )
}

function repairHttpEnvironmentState(): void {
  const paths = getHttpPaths(getVaultPath())
  const state = loadHttpState(paths)
  const usedIds = new Set<number>()
  let nextId = Math.max(
    state.counters.environmentId,
    ...state.environments.map(env =>
      Number.isInteger(env.id) && env.id > 0 ? env.id : 0,
    ),
  )

  state.environments.forEach((environment) => {
    if (
      !Number.isInteger(environment.id)
      || environment.id <= 0
      || usedIds.has(environment.id)
    ) {
      nextId += 1
      environment.id = nextId
    }
    usedIds.add(environment.id)

    if (!environment.variables || typeof environment.variables !== 'object') {
      environment.variables = {}
    }
  })

  if (
    state.activeEnvironmentId !== null
    && !state.environments.some(env => env.id === state.activeEnvironmentId)
  ) {
    state.activeEnvironmentId = null
  }
  state.counters.environmentId = Math.max(nextId, state.counters.environmentId)
  writeSpaceStateImmediate(paths.statePath, state)
}

function repairMathState(): void {
  // math/.state.yaml может быть ещё не докачан из облака: запись поверх
  // плейсхолдера уничтожила бы облачную версию.
  let state: MathNotebookStore
  try {
    state = readNormalizedMathState().state
  }
  catch (error) {
    if (isCloudFileNotDownloadedError(error)) {
      return
    }

    throw error
  }

  writeSpaceStateImmediate(getMathStatePath(), state)
}

function isAppliedBySpaceSync(
  item: VaultDoctorItem,
  conflictedSpaces: Set<VaultDoctorSpace>,
): boolean {
  if (
    item.action === 'repair-environment-state'
    || item.action === 'repair-math-state'
  ) {
    return true
  }

  return !conflictedSpaces.has(item.space)
}

export function applyVaultDoctor(
  input?: VaultDoctorInput,
): VaultDoctorResponse {
  const before = previewVaultDoctor(input)
  const appliedDecisionItems = applyDuplicateIdDecisions(
    before,
    input?.decisions,
  )
  const afterDecisions = previewVaultDoctor(input)
  const conflictedSpaces = spacesWithConflicts(afterDecisions)
  const spaces = normalizeSpaces(input)

  if (spaces.includes('code') && !conflictedSpaces.has('code')) {
    syncRuntimeWithDisk(getPaths(getVaultPath()))
  }
  if (spaces.includes('notes') && !conflictedSpaces.has('notes')) {
    syncNotesRuntimeWithDisk(getNotesPaths(getVaultPath()))
  }
  if (spaces.includes('http')) {
    if (!conflictedSpaces.has('http')) {
      syncHttpRuntimeWithDisk(getHttpPaths(getVaultPath()))
    }
    repairHttpEnvironmentState()
  }
  if (spaces.includes('math')) {
    repairMathState()
  }

  const after = previewVaultDoctor(input)
  const appliedItems = before.items
    .filter(
      item =>
        item.status === 'pending'
        && isAppliedBySpaceSync(item, conflictedSpaces),
    )
    .map(item => ({
      ...item,
      status: 'applied' as const,
    }))

  return {
    conflictGroups: after.conflictGroups,
    items: [...appliedDecisionItems, ...appliedItems, ...after.items],
    summary: buildSummary({
      conflictGroups: after.conflictGroups,
      items: [...appliedDecisionItems, ...appliedItems, ...after.items],
      warnings: after.warnings,
    }),
    warnings: after.warnings,
  }
}
