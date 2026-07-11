import type {
  HttpFolderRecord,
  HttpPaths,
  HttpRequestIndexMetadata,
  HttpRequestRecord,
  HttpRuntimeCache,
  HttpState,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { log } from '../../../../../utils'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { normalizeFlag } from '../../runtime/normalizers'
import {
  getFileAvailability,
  primeDatalessChecks,
} from '../../runtime/shared/cloudFiles'
import { isCloudFileNotDownloadedError } from '../../runtime/shared/guardedRead'
import {
  readDirEntriesFailClosed,
  toPosixPath,
} from '../../runtime/shared/path'
import { createVaultReconciler } from '../../runtime/shared/vaultReconcile'
import { HTTP_STATE_FILE_NAME, httpRuntimeRef } from './constants'
import {
  normalizeBodyType,
  normalizeMethod,
  parseRequestFile,
  serializeRequestFile,
  writeRequestFile,
} from './parser'
import {
  createDefaultHttpState,
  ensureHttpStateFile,
  loadHttpState,
  saveHttpState,
} from './state'

const SKIP_FILES = new Set([HTTP_STATE_FILE_NAME])

interface DiskWalkResult {
  folderRelativePaths: string[]
  requestRelativePaths: string[]
}

function walkHttpDir(rootPath: string, currentPath = rootPath): DiskWalkResult {
  const result: DiskWalkResult = {
    folderRelativePaths: [],
    requestRelativePaths: [],
  }

  const entries = readDirEntriesFailClosed(currentPath)

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }

    const absolutePath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))
      result.folderRelativePaths.push(relativePath)
      const nested = walkHttpDir(rootPath, absolutePath)
      result.folderRelativePaths.push(...nested.folderRelativePaths)
      result.requestRelativePaths.push(...nested.requestRelativePaths)
      continue
    }

    if (
      entry.isFile()
      && entry.name.endsWith('.md')
      && !SKIP_FILES.has(entry.name)
    ) {
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))
      result.requestRelativePaths.push(relativePath)
    }
  }

  return result
}

function reconcileFolders(
  state: HttpState,
  folderRelativePaths: string[],
): Map<string, number> {
  const existingByPath = new Map<string, HttpFolderRecord>()
  const existingPathById = new Map<number, string>()

  // Build current path → folder map from existing state
  function buildPath(
    folder: HttpFolderRecord,
    lookup: Map<number, HttpFolderRecord>,
  ): string {
    const segments: string[] = []
    let current: HttpFolderRecord | undefined = folder
    while (current) {
      segments.unshift(current.name)
      current
        = current.parentId !== null ? lookup.get(current.parentId) : undefined
    }
    return segments.join('/')
  }

  const folderById = new Map(
    state.folders.map(folder => [folder.id, folder]),
  )
  for (const folder of state.folders) {
    const fullPath = buildPath(folder, folderById)
    existingByPath.set(fullPath, folder)
    existingPathById.set(folder.id, fullPath)
  }

  const now = Date.now()
  const sortedDiskPaths = [...folderRelativePaths].sort(
    (a, b) => a.split('/').length - b.split('/').length,
  )

  const nextFolders: HttpFolderRecord[] = []
  const folderIdByPath = new Map<string, number>()

  for (const relativePath of sortedDiskPaths) {
    const segments = relativePath.split('/')
    const name = segments[segments.length - 1]
    const parentPath = segments.slice(0, -1).join('/')
    const parentId = parentPath
      ? (folderIdByPath.get(parentPath) ?? null)
      : null

    const existing = existingByPath.get(relativePath)
    if (existing) {
      const updated: HttpFolderRecord = {
        ...existing,
        name,
        parentId,
      }
      nextFolders.push(updated)
      folderIdByPath.set(relativePath, updated.id)
      continue
    }

    state.counters.folderId += 1
    const id = state.counters.folderId
    nextFolders.push({
      id,
      name,
      icon: null,
      parentId,
      isOpen: 0,
      orderIndex: nextFolders.length,
      createdAt: now,
      updatedAt: now,
    })
    folderIdByPath.set(relativePath, id)
  }

  state.folders = nextFolders
  return folderIdByPath
}

// Метаданные индекса собираются только по реально прочитанному файлу, а
// stat-сигнатура — по stat до чтения. Записи приложения не обновляют meta:
// изменённый mtime просто заставит перечитать файл на следующем старте.
function buildHttpRequestIndexMetadata(
  record: HttpRequestRecord,
  stats: { mtimeMs: number, size: number },
): HttpRequestIndexMetadata {
  return {
    auth: record.auth,
    bodyType: record.bodyType,
    createdAt: record.createdAt,
    description: record.description,
    formData: record.formData,
    headers: record.headers,
    isDeleted: record.isDeleted,
    isFavorites: record.isFavorites,
    method: record.method,
    mtimeMs: stats.mtimeMs,
    name: record.name,
    query: record.query,
    size: stats.size,
    updatedAt: record.updatedAt,
    url: record.url,
  }
}

// .state.yaml синхронизируется между устройствами и правится извне, поэтому
// метаданные индекса перед использованием проверяются по форме: битая
// запись не роняет скан, файл просто перечитывается.
function isValidHttpRequestIndexMetadata(
  meta: HttpRequestIndexMetadata | undefined,
): meta is HttpRequestIndexMetadata {
  return (
    !!meta
    && typeof meta === 'object'
    && typeof meta.name === 'string'
    && typeof meta.method === 'string'
    && typeof meta.bodyType === 'string'
    && typeof meta.url === 'string'
    // meta без description (ранний dev-формат) бракуется: файл будет
    // перечитан один раз, и индекс дозаполнится.
    && typeof meta.description === 'string'
    && Array.isArray(meta.headers)
    && Array.isArray(meta.query)
    && Array.isArray(meta.formData)
    && !!meta.auth
    && typeof meta.auth === 'object'
    && typeof meta.mtimeMs === 'number'
    && Number.isFinite(meta.mtimeMs)
    && typeof meta.size === 'number'
    && Number.isFinite(meta.size)
    && typeof meta.createdAt === 'number'
    && typeof meta.updatedAt === 'number'
  )
}

// Запись из метаданных индекса, без чтения файла: body дочитывается лениво
// (ensureRequestDetailsLoaded), description уже есть в метаданных.
function buildRequestFromIndexMetadata(
  entryId: number,
  relativePath: string,
  meta: HttpRequestIndexMetadata,
  folderId: number | null,
  options?: { pendingCloudDownload?: boolean },
): HttpRequestRecord {
  // Enum-поля нормализуются: .state.yaml мог быть правлен извне, а мусорное
  // значение уронило бы валидацию DTO целого списка.
  return {
    id: entryId,
    name: meta.name,
    folderId,
    method: normalizeMethod(meta.method),
    url: meta.url,
    headers: meta.headers,
    query: meta.query,
    bodyType: normalizeBodyType(meta.bodyType),
    body: null,
    formData: meta.formData,
    auth: meta.auth,
    description: meta.description,
    filePath: relativePath,
    isFavorites: normalizeFlag(meta.isFavorites),
    isDeleted: normalizeFlag(meta.isDeleted),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    detailsPending: true,
    ...(options?.pendingCloudDownload ? { pendingCloudDownload: true } : {}),
  }
}

// Минимальная placeholder-запись для недоступного файла без метаданных
// индекса: entries из v5.8-state имеют только {id, filePath}, и без такой
// записи весь старый offloaded vault выглядел бы пустым до докачки
// (offline — бессрочно). Имя берётся из имени файла, детали дочитаются
// после докачки, мутации и отправка заблокированы pendingCloudDownload.
function buildPlaceholderRequest(
  entryId: number,
  relativePath: string,
  folderId: number | null,
  now: number,
): HttpRequestRecord {
  return {
    auth: { type: 'none' },
    body: null,
    bodyType: 'none',
    createdAt: now,
    description: '',
    detailsPending: true,
    filePath: relativePath,
    folderId,
    formData: [],
    headers: [],
    id: entryId,
    isDeleted: 0,
    isFavorites: 0,
    method: 'GET',
    name: path.posix.basename(relativePath, '.md'),
    pendingCloudDownload: true,
    query: [],
    updatedAt: now,
    url: '',
  }
}

function reconcileRequests(
  paths: HttpPaths,
  state: HttpState,
  requestRelativePaths: string[],
  folderIdByPath: Map<string, number>,
): HttpRequestRecord[] {
  const existingByPath = new Map(
    state.requests.map(item => [item.filePath, item]),
  )

  // Один batch-вызов точной проверки dataless на весь список вместо
  // отдельного системного вызова на каждый подозрительный файл.
  primeDatalessChecks(
    requestRelativePaths.map(relativePath =>
      path.join(paths.httpRoot, relativePath),
    ),
  )

  const usedIds = new Set<number>()
  const records: HttpRequestRecord[] = []
  const indexEntries: HttpState['requests'] = []
  const now = Date.now()

  const resolveFolderId = (relativePath: string): number | null => {
    const dirPath = path.posix.dirname(relativePath)
    return dirPath && dirPath !== '.'
      ? (folderIdByPath.get(dirPath) ?? null)
      : null
  }

  // Файл, содержимое которого сейчас недоступно (облачный плейсхолдер или
  // сбой чтения), не читается синхронно: он уходит в фоновую докачку,
  // которая триггерит повторный sync http-пространства. Уже известный
  // запрос при этом сохраняет свою запись в индексе (вместе с метаданными),
  // иначе он «исчез» бы из state и после докачки получил бы новый id.
  // Запрос сразу виден в списке placeholder-записью — как сниппеты и
  // заметки: полной при известных метаданных, минимальной (имя из файла)
  // для v5.8-entries без meta.
  const keepUnavailableRequest = (
    absolutePath: string,
    relativePath: string,
  ) => {
    enqueueCloudDownload(absolutePath)

    const knownEntry = existingByPath.get(relativePath)
    if (knownEntry && !usedIds.has(knownEntry.id)) {
      usedIds.add(knownEntry.id)
      indexEntries.push({
        filePath: relativePath,
        id: knownEntry.id,
        ...(knownEntry.meta ? { meta: knownEntry.meta } : {}),
      })

      if (isValidHttpRequestIndexMetadata(knownEntry.meta)) {
        records.push(
          buildRequestFromIndexMetadata(
            knownEntry.id,
            relativePath,
            knownEntry.meta,
            resolveFolderId(relativePath),
            { pendingCloudDownload: true },
          ),
        )
      }
      else {
        records.push(
          buildPlaceholderRequest(
            knownEntry.id,
            relativePath,
            resolveFolderId(relativePath),
            now,
          ),
        )
      }
    }
  }

  for (const relativePath of requestRelativePaths) {
    const absolutePath = path.join(paths.httpRoot, relativePath)
    const availability = getFileAvailability(absolutePath)

    if (availability.isCloudPlaceholder) {
      keepUnavailableRequest(absolutePath, relativePath)
      continue
    }

    // Свежая stat-сигнатура: запись строится из индекса без чтения файла,
    // body и description дочитываются лениво по первому обращению.
    const existingEntry = existingByPath.get(relativePath)
    if (
      existingEntry
      && !usedIds.has(existingEntry.id)
      && availability.stats
      && isValidHttpRequestIndexMetadata(existingEntry.meta)
      && existingEntry.meta.mtimeMs === availability.stats.mtimeMs
      && existingEntry.meta.size === availability.stats.size
    ) {
      usedIds.add(existingEntry.id)
      if (existingEntry.id > state.counters.requestId) {
        state.counters.requestId = existingEntry.id
      }

      records.push(
        buildRequestFromIndexMetadata(
          existingEntry.id,
          relativePath,
          existingEntry.meta,
          resolveFolderId(relativePath),
        ),
      )
      indexEntries.push({
        filePath: relativePath,
        id: existingEntry.id,
        meta: existingEntry.meta,
      })
      continue
    }

    let source: string
    try {
      source = fs.readFileSync(absolutePath, 'utf8')
    }
    catch (error) {
      log('storage:http:read-request', error)
      keepUnavailableRequest(absolutePath, relativePath)
      continue
    }

    const parsed = parseRequestFile(source)
    const fmId = parsed.frontmatter.id

    let id = existingEntry?.id
    let needsRewrite = !parsed.hasFrontmatter

    if (!id) {
      if (typeof fmId === 'number' && fmId > 0 && !usedIds.has(fmId)) {
        id = fmId
      }
      else {
        state.counters.requestId += 1
        id = state.counters.requestId
        needsRewrite = true
      }
    }

    if (id > state.counters.requestId) {
      state.counters.requestId = id
    }
    usedIds.add(id)

    const folderId = resolveFolderId(relativePath)

    const fileName = path.posix.basename(relativePath, '.md')
    const fmCreatedAt = parsed.frontmatter.createdAt
    const fmUpdatedAt = parsed.frontmatter.updatedAt

    const record: HttpRequestRecord = {
      id,
      name: parsed.frontmatter.name || fileName,
      folderId,
      method: parsed.normalized.method,
      url: parsed.normalized.url,
      headers: parsed.normalized.headers,
      query: parsed.normalized.query,
      bodyType: parsed.normalized.bodyType,
      body: parsed.normalized.body,
      formData: parsed.normalized.formData,
      auth: parsed.normalized.auth,
      description: parsed.description,
      filePath: relativePath,
      isDeleted: parsed.normalized.isDeleted,
      isFavorites: parsed.normalized.isFavorites,
      createdAt: typeof fmCreatedAt === 'number' ? fmCreatedAt : now,
      updatedAt: typeof fmUpdatedAt === 'number' ? fmUpdatedAt : now,
    }

    if (needsRewrite || serializeRequestFile(record) !== source) {
      writeRequestFile(paths.httpRoot, record, { skipIfUnavailable: true })
    }

    records.push(record)
    // Индекс обновляется по реально прочитанному файлу: следующий холодный
    // старт соберёт запись без чтения. Write-back выше сдвигает mtime после
    // снятой сигнатуры — такой файл будет перечитан один раз и заживёт.
    indexEntries.push({
      id,
      filePath: relativePath,
      meta: availability.stats
        ? buildHttpRequestIndexMetadata(record, availability.stats)
        : undefined,
    })
  }

  state.requests = indexEntries
  return records
}

function buildRuntimeCache(
  paths: HttpPaths,
  state: HttpState,
  records: HttpRequestRecord[],
): HttpRuntimeCache {
  return {
    paths,
    state,
    requestById: new Map(records.map(record => [record.id, record])),
    folderById: new Map(state.folders.map(folder => [folder.id, folder])),
  }
}

const httpVaultReconciler = createVaultReconciler('http')

// Полные обходы диска (например, Vault Doctor) допустимы только после
// фоновой сверки: до неё листинги каталогов могут блокироваться сетью.
export function isHttpVaultDiskReady(paths: HttpPaths): boolean {
  return httpVaultReconciler.isReconciled(paths.httpRoot)
}

// Мгновенный кэш из state без обхода диска: запросы появятся после фоновой
// сверки, их записи в state сохраняются (id стабильны).
function buildProvisionalHttpCache(paths: HttpPaths): HttpRuntimeCache {
  if (
    httpRuntimeRef.cache
    && httpRuntimeRef.cache.paths.httpRoot === paths.httpRoot
  ) {
    return httpRuntimeRef.cache
  }

  ensureHttpStateFile(paths)

  // .state.yaml сам может быть облачным плейсхолдером: тогда loadHttpState
  // бросает, а кэш строится на неперсистируемом дефолтном state (флаг
  // provisional блокирует запись и мутации до докачки). Пространство
  // наполнится после докачки state и повторной сверки.
  let state: HttpState
  try {
    state = loadHttpState(paths)
  }
  catch (error) {
    if (!isCloudFileNotDownloadedError(error)) {
      throw error
    }
    state = createDefaultHttpState()
    state.provisional = true
  }

  const cache = buildRuntimeCache(paths, state, [])
  httpRuntimeRef.cache = cache
  return cache
}

// Настоящая сверка с диском: может бросить, если .state.yaml сам недокачан
// из облака (reconciler ретраит по этой ошибке).
function performFullHttpSync(paths: HttpPaths): HttpRuntimeCache {
  ensureHttpStateFile(paths)
  const state = loadHttpState(paths)

  const walk = walkHttpDir(paths.httpRoot)
  const folderIdByPath = reconcileFolders(state, walk.folderRelativePaths)
  const records = reconcileRequests(
    paths,
    state,
    walk.requestRelativePaths,
    folderIdByPath,
  )

  saveHttpState(paths, state)

  const cache = buildRuntimeCache(paths, state, records)
  httpRuntimeRef.cache = cache
  return cache
}

export function syncHttpRuntimeWithDisk(paths: HttpPaths): HttpRuntimeCache {
  // Первый доступ к vault: обход диска опасен синхронно (листинги
  // dataless-каталогов материализуются сетью), поэтому мгновенно отдаётся
  // provisional-кэш, а настоящая сверка выполняется в фоне.
  if (!httpVaultReconciler.isReconciled(paths.httpRoot)) {
    const provisionalCache = buildProvisionalHttpCache(paths)

    httpVaultReconciler.begin(paths.httpRoot, () => {
      if (
        httpRuntimeRef.cache
        && httpRuntimeRef.cache.paths.httpRoot !== paths.httpRoot
      ) {
        return
      }

      performFullHttpSync(paths)
    })

    return provisionalCache
  }

  return performFullHttpSync(paths)
}

export function getHttpRuntimeCache(paths: HttpPaths): HttpRuntimeCache {
  if (
    httpRuntimeRef.cache
    && httpRuntimeRef.cache.paths.httpRoot === paths.httpRoot
  ) {
    return httpRuntimeRef.cache
  }

  return syncHttpRuntimeWithDisk(paths)
}

export function resetHttpRuntimeCache(): void {
  httpRuntimeRef.cache = null
}
