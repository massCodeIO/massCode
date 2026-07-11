import type { SnippetRecord } from '../../../contracts'
import type { FileAvailability } from './shared/cloudFiles'
import type {
  DirectoryEntriesCache,
  MarkdownSnippet,
  MarkdownSnippetIndexItem,
  MarkdownSnippetIndexMetadata,
  MarkdownState,
  Paths,
  PersistSnippetOptions,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { log } from '../../../../utils'
import { enqueueCloudDownload } from '../cloudDownloads'
import { runtimeRef } from './cache'
import {
  INBOX_DIR_NAME,
  INBOX_RELATIVE_PATH,
  LEGACY_INBOX_RELATIVE_PATH,
  LEGACY_TRASH_RELATIVE_PATH,
  META_DIR_NAME,
  TRASH_DIR_NAME,
  TRASH_RELATIVE_PATH,
} from './constants'
import { normalizeNullableNumber, normalizeNumber } from './normalizers'
import {
  parseBodyFragmentsWithMetadata,
  serializeSnippet,
  splitFrontmatter,
} from './parser'
import {
  buildPathToFolderIdMap,
  findFolderById,
  getFolderPathById,
  normalizeDirectoryPath,
} from './paths'
import { rememberAppFileChange } from './shared/appChanges'
import { getFileAvailability } from './shared/cloudFiles'
import { throwCloudContentUnavailable } from './shared/cloudGuards'
import {
  getCachedDirectoryEntries,
  removeDirectoryEntryFromCache,
  upsertDirectoryEntryInCache,
} from './shared/directoryEntries'
import { listMarkdownFiles as listMarkdownFilesShared } from './shared/path'
import { invalidateSearchIndex } from './shared/searchEngine'
import {
  getFileTimestampFallbacks,
  normalizeTimestamp,
} from './shared/timestamp'
import { throwStorageError, toSnippetFileName } from './validation'

export function isInboxSnippetDirectory(directoryPath: string): boolean {
  return (
    directoryPath === ''
    || directoryPath === INBOX_RELATIVE_PATH
    || directoryPath === LEGACY_INBOX_RELATIVE_PATH
  )
}

export function isTrashSnippetDirectory(directoryPath: string): boolean {
  return (
    directoryPath === TRASH_RELATIVE_PATH
    || directoryPath === LEGACY_TRASH_RELATIVE_PATH
  )
}

export function listMarkdownFiles(rootPath: string): string[] {
  // This helper always runs inside the resolved code space root, not vault root.
  return listMarkdownFilesShared(
    rootPath,
    META_DIR_NAME,
    INBOX_DIR_NAME,
    TRASH_DIR_NAME,
    new Set(),
  )
}

// 'unreadable' означает, что файл существует, но его содержимое сейчас
// недоступно (облачный плейсхолдер или сбой чтения). Каллеры обязаны
// пропустить такой файл до фоновой докачки: null здесь означал бы «id нет»
// и привёл бы к чеканке нового id, расходящегося с frontmatter-id файла.
export function readFrontmatterIdFromSnippetFile(
  snippetPath: string,
): number | null | 'unreadable' {
  const availability = getFileAvailability(snippetPath)

  if (!availability.exists) {
    return null
  }

  if (availability.isCloudPlaceholder) {
    return 'unreadable'
  }

  try {
    const source = fs.readFileSync(snippetPath, 'utf8')
    const { frontmatter } = splitFrontmatter(source)
    const id = normalizeNumber(frontmatter.id)

    return id > 0 ? id : null
  }
  catch {
    return 'unreadable'
  }
}

export function readSnippetFromFile(
  paths: Paths,
  entry: MarkdownSnippetIndexItem,
  pathToFolderIdMap: ReadonlyMap<string, number>,
  knownAvailability?: FileAvailability,
): MarkdownSnippet | null {
  return (
    readSnippetFromFileWithMetadata(
      paths,
      entry,
      pathToFolderIdMap,
      knownAvailability,
    )?.snippet ?? null
  )
}

export function buildPlaceholderSnippet(
  entry: MarkdownSnippetIndexItem,
  pathToFolderIdMap: ReadonlyMap<string, number>,
  timestampFallbacks: { createdAt: number, updatedAt: number },
): MarkdownSnippet {
  const normalizedFileDirectory = normalizeDirectoryPath(
    path.posix.dirname(entry.filePath),
  )
  const isTrashed = isTrashSnippetDirectory(normalizedFileDirectory)
  const folderId
    = isTrashed || isInboxSnippetDirectory(normalizedFileDirectory)
      ? null
      : (pathToFolderIdMap.get(normalizedFileDirectory) ?? null)

  return {
    contents: [],
    createdAt: timestampFallbacks.createdAt,
    description: null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: isTrashed ? 1 : 0,
    isFavorites: 0,
    name: path.posix.basename(entry.filePath, '.md'),
    pendingCloudDownload: true,
    tags: [],
    updatedAt: timestampFallbacks.updatedAt,
  }
}

export function readSnippetFromFileWithMetadata(
  paths: Paths,
  entry: MarkdownSnippetIndexItem,
  pathToFolderIdMap: ReadonlyMap<string, number>,
  knownAvailability?: FileAvailability,
): {
  legacyRecovery: 'ambiguous' | 'none' | 'recovered'
  snippet: MarkdownSnippet
} | null {
  const snippetPath = path.join(paths.vaultPath, entry.filePath)
  // Горячий путь скана уже статил файл: повторный stat не нужен.
  const availability = knownAvailability ?? getFileAvailability(snippetPath)

  if (!availability.exists) {
    return null
  }

  const now = Date.now()
  const timestampFallbacks = getFileTimestampFallbacks(
    snippetPath,
    now,
    availability.stats,
  )

  let source: string | null = null

  if (!availability.isCloudPlaceholder) {
    try {
      source = fs.readFileSync(snippetPath, 'utf8')
    }
    catch (error) {
      // Сорвавшееся чтение (обрыв облачного провайдера, EIO и т.п.) не
      // валит весь скан: запись обрабатывается как недокачанная.
      log('storage:markdown:read-snippet', error)
    }
  }

  // Плейсхолдер (или файл со сбоем чтения) не читается синхронно: сниппет
  // сразу показывается в списке по данным индекса и имени файла,
  // содержимое докачивается в фоне.
  if (source === null) {
    enqueueCloudDownload(snippetPath)

    return {
      legacyRecovery: 'none',
      snippet: buildPlaceholderSnippet(
        entry,
        pathToFolderIdMap,
        timestampFallbacks,
      ),
    }
  }

  const { body, frontmatter, hasFrontmatter } = splitFrontmatter(source)
  const metaContents = Array.isArray(frontmatter.contents)
    ? frontmatter.contents
    : []
  const { fragments, legacyRecovery } = parseBodyFragmentsWithMetadata(
    body,
    metaContents,
  )

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

  const snippet: MarkdownSnippet = {
    contents,
    createdAt: normalizeTimestamp(
      frontmatter.createdAt,
      timestampFallbacks.createdAt,
    ),
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
    updatedAt: normalizeTimestamp(
      frontmatter.updatedAt,
      timestampFallbacks.updatedAt,
    ),
  }

  if (!hasFrontmatter) {
    writeSnippetToFile(paths, snippet, { skipIfUnavailable: true })
  }

  return { legacyRecovery, snippet }
}

// Метаданные индекса собираются только по реально прочитанному файлу, а
// stat-сигнатура — по stat до чтения. Записи приложения не обновляют meta:
// изменённый mtime просто заставит перечитать файл на следующем старте.
export function buildSnippetIndexMetadata(
  snippet: MarkdownSnippet,
  stats: { mtimeMs: number, size: number },
): MarkdownSnippetIndexMetadata {
  return {
    contents: snippet.contents.map(({ id, label, language }) => ({
      id,
      label,
      language,
    })),
    createdAt: snippet.createdAt,
    description: snippet.description,
    isDeleted: snippet.isDeleted,
    isFavorites: snippet.isFavorites,
    mtimeMs: stats.mtimeMs,
    name: snippet.name,
    size: stats.size,
    tags: [...snippet.tags],
    updatedAt: snippet.updatedAt,
  }
}

// state.json синхронизируется между устройствами и правится извне, поэтому
// метаданные индекса перед использованием проверяются по форме: битая запись
// не роняет скан, файл просто перечитывается.
function isValidSnippetIndexMetadata(
  meta: MarkdownSnippetIndexMetadata | undefined,
): meta is MarkdownSnippetIndexMetadata {
  return (
    !!meta
    && typeof meta === 'object'
    && Array.isArray(meta.contents)
    && meta.contents.every(
      content =>
        content
        && typeof content === 'object'
        && typeof content.id === 'number'
        && typeof content.label === 'string'
        && typeof content.language === 'string',
    )
    && Array.isArray(meta.tags)
    && typeof meta.name === 'string'
    && typeof meta.mtimeMs === 'number'
    && Number.isFinite(meta.mtimeMs)
    && typeof meta.size === 'number'
    && Number.isFinite(meta.size)
    && typeof meta.createdAt === 'number'
    && typeof meta.updatedAt === 'number'
  )
}

export function hasFreshSnippetIndexMetadata(
  entry: MarkdownSnippetIndexItem,
  stats: { mtimeMs: number, size: number } | null,
): boolean {
  return (
    !!stats
    && isValidSnippetIndexMetadata(entry.meta)
    && entry.meta.mtimeMs === stats.mtimeMs
    && entry.meta.size === stats.size
  )
}

// Запись списка из метаданных индекса, без чтения файла: тела фрагментов
// остаются value: null и дочитываются лениво (ensureSnippetContentLoaded).
export function buildSnippetFromIndexMetadata(
  entry: MarkdownSnippetIndexItem,
  meta: MarkdownSnippetIndexMetadata,
  pathToFolderIdMap: ReadonlyMap<string, number>,
  options?: { pendingCloudDownload?: boolean },
): MarkdownSnippet {
  const normalizedFileDirectory = normalizeDirectoryPath(
    path.posix.dirname(entry.filePath),
  )
  const isTrashed = isTrashSnippetDirectory(normalizedFileDirectory)
  const folderId
    = isTrashed || isInboxSnippetDirectory(normalizedFileDirectory)
      ? null
      : (pathToFolderIdMap.get(normalizedFileDirectory) ?? null)

  return {
    contents: meta.contents.map(content => ({
      id: content.id,
      label: content.label,
      language: content.language,
      value: null,
    })),
    createdAt: meta.createdAt,
    description: meta.description ?? null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: isTrashed ? 1 : normalizeNumber(meta.isDeleted),
    isFavorites: normalizeNumber(meta.isFavorites),
    name: meta.name,
    ...(options?.pendingCloudDownload ? { pendingCloudDownload: true } : {}),
    tags: meta.tags.filter(tagId => typeof tagId === 'number' && tagId > 0),
    updatedAt: meta.updatedAt,
  }
}

// Дочитывает тела фрагментов записи, построенной из индекса. Заполняются
// только value === null: метаданные runtime-объекта авторитетны и могут
// содержать ещё не сохранённые правки. Возвращает false, если содержимое
// сейчас недоступно (плейсхолдер, сбой чтения).
export function ensureSnippetContentLoaded(
  paths: Paths,
  snippet: MarkdownSnippet,
): boolean {
  if (snippet.pendingCloudDownload) {
    return false
  }

  if (!snippet.contents.some(content => content.value === null)) {
    return true
  }

  const snippetPath = path.join(paths.vaultPath, snippet.filePath)
  const availability = getFileAvailability(snippetPath)

  if (!availability.exists) {
    return false
  }

  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(snippetPath)
    return false
  }

  let source: string
  try {
    source = fs.readFileSync(snippetPath, 'utf8')
  }
  catch (error) {
    log('storage:markdown:load-snippet-content', error)
    enqueueCloudDownload(snippetPath)
    return false
  }

  const { body, frontmatter } = splitFrontmatter(source)
  const metaContents = Array.isArray(frontmatter.contents)
    ? frontmatter.contents
    : []
  const { fragments } = parseBodyFragmentsWithMetadata(body, metaContents)

  snippet.contents.forEach((content, index) => {
    if (content.value === null) {
      content.value = fragments[index]?.value ?? ''
    }
  })

  // Тело догружено после построения поискового индекса: индекс мог быть
  // собран без тел, и body-запросы не находили запись. Любая гидрация
  // (открытие записи, preview, поиск) помечает индекс dirty.
  const cache = runtimeRef.cache
  if (cache?.snippetById.get(snippet.id) === snippet) {
    invalidateSearchIndex(cache.searchIndex)
  }

  return true
}

export function loadSnippets(
  paths: Paths,
  state: MarkdownState,
  options?: { rewriteRecoveredLegacyFences?: boolean },
): MarkdownSnippet[] {
  const pathToFolderIdMap = buildPathToFolderIdMap(state)

  return state.snippets
    .map((item) => {
      const snippetPath = path.join(paths.vaultPath, item.filePath)
      const availability = getFileAvailability(snippetPath)

      if (!availability.exists) {
        return null
      }

      // Свежая stat-сигнатура: запись строится из индекса без чтения файла,
      // тело дочитывается лениво по первому обращению.
      if (
        !availability.isCloudPlaceholder
        && hasFreshSnippetIndexMetadata(item, availability.stats)
      ) {
        return buildSnippetFromIndexMetadata(
          item,
          item.meta!,
          pathToFolderIdMap,
        )
      }

      // Плейсхолдер с известными метаданными: полноценная запись списка без
      // чтения (и без сетевой материализации), контент докачивается в фоне.
      if (
        availability.isCloudPlaceholder
        && isValidSnippetIndexMetadata(item.meta)
      ) {
        enqueueCloudDownload(snippetPath)
        return buildSnippetFromIndexMetadata(
          item,
          item.meta,
          pathToFolderIdMap,
          {
            pendingCloudDownload: true,
          },
        )
      }

      const result = readSnippetFromFileWithMetadata(
        paths,
        item,
        pathToFolderIdMap,
        availability,
      )

      if (
        options?.rewriteRecoveredLegacyFences
        && result?.legacyRecovery === 'recovered'
      ) {
        writeSnippetToFile(paths, result.snippet, { skipIfUnavailable: true })
      }

      if (
        result
        && !result.snippet.pendingCloudDownload
        && availability.stats
      ) {
        item.meta = buildSnippetIndexMetadata(
          result.snippet,
          availability.stats,
        )
      }

      return result?.snippet ?? null
    })
    .filter((snippet): snippet is MarkdownSnippet => !!snippet)
}

export function writeSnippetToFile(
  paths: Paths,
  snippet: MarkdownSnippet,
  options?: { skipIfUnavailable?: boolean },
): void {
  const snippetPath = path.join(paths.vaultPath, snippet.filePath)

  // Запись в плейсхолдер уничтожила бы ещё не скачанное облачное
  // содержимое, поэтому она запрещена: файл сначала докачивается в фоне.
  // По умолчанию сбой поднимается наверх: тихий пропуск означал бы «принятую»
  // правку, которую докачка затем молча перезапишет облачным содержимым.
  // Пропуск допустим только там, где запись — необязательный write-back
  // (scan, move, bulk-очистка тегов), а не сохранение пользовательской правки.
  const availability = getFileAvailability(snippetPath)
  if (snippet.pendingCloudDownload || availability.isCloudPlaceholder) {
    enqueueCloudDownload(snippetPath)
    if (options?.skipIfUnavailable) {
      return
    }
    throwCloudContentUnavailable()
  }

  // Ленивая запись (тела ещё не дочитаны из индекса): недостающие value
  // дочитываются с диска перед сериализацией, иначе запись затёрла бы тела
  // пустыми строками. Тихий пропуск записи потерял бы правку метаданных
  // при следующем скане, поэтому сбой поднимается наверх. В scan-путях
  // (write-back после чтения) сниппет уже прочитан и ветка недостижима.
  if (!ensureSnippetContentLoaded(paths, snippet)) {
    throwCloudContentUnavailable()
  }

  const nextContent = serializeSnippet(snippet)

  fs.ensureDirSync(path.dirname(snippetPath))

  if (availability.exists) {
    const currentContent = fs.readFileSync(snippetPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.writeFileSync(snippetPath, nextContent, 'utf8')
  rememberAppFileChange(snippetPath)
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

export function getSnippetTargetDirectory(
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

export function buildSnippetTargetPath(
  state: MarkdownState,
  snippet: MarkdownSnippet,
): string {
  const directory = getSnippetTargetDirectory(state, snippet)
  const fileName = toSnippetFileName(snippet.name)

  return directory ? path.posix.join(directory, fileName) : fileName
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

export function persistSnippet(
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
    rememberAppFileChange(sourceAbsolutePath)
    rememberAppFileChange(targetAbsolutePath)

    removeDirectoryEntryFromCache(
      path.dirname(sourceAbsolutePath),
      path.basename(sourceAbsolutePath),
      directoryEntriesCache,
    )
  }

  snippet.filePath = targetPath
  writeSnippetToFile(paths, snippet, {
    skipIfUnavailable: options?.skipWriteIfUnavailable,
  })
  upsertDirectoryEntryInCache(
    path.dirname(targetAbsolutePath),
    path.basename(targetAbsolutePath),
    directoryEntriesCache,
  )
  upsertSnippetIndex(state, snippet)
}

export function createSnippetRecord(
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
    pendingCloudDownload: snippet.pendingCloudDownload === true,
    tags,
    updatedAt: snippet.updatedAt,
  }
}

export function findSnippetById(
  snippets: MarkdownSnippet[],
  id: number,
): MarkdownSnippet | undefined {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.snippets === snippets ? cache : null

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

/**
 * Global content lookup is only safe for non-mutating fallback flows.
 * Mutation paths with a known owner must scope lookup by snippet id first.
 */
export function findSnippetByContentId(
  snippets: MarkdownSnippet[],
  contentId: number,
): {
  contentIndex: number
  snippet: MarkdownSnippet
} | null {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.snippets === snippets ? cache : null

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

export function getStateSnippetIndexByFilePath(
  state: MarkdownState,
  filePath: string,
): number {
  const normalizedFilePath = filePath.toLowerCase()

  return state.snippets.findIndex(
    item => item.filePath.toLowerCase() === normalizedFilePath,
  )
}
