import type {
  MarkdownNote,
  NoteProperties,
  NotesFrontmatter,
  NotesIndexItem,
  NotesIndexMetadata,
  NotesPaths,
  NotesState,
  PersistNoteOptions,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { log } from '../../../../../utils'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { normalizeFlag } from '../../runtime/normalizers'
import { splitFrontmatter } from '../../runtime/parser'
import { rememberAppFileChange } from '../../runtime/shared/appChanges'
import { getFileAvailability } from '../../runtime/shared/cloudFiles'
import {
  getCachedDirectoryEntries,
  removeDirectoryEntryFromCache,
  upsertDirectoryEntryInCache,
} from '../../runtime/shared/directoryEntries'
import {
  listMarkdownFiles as listMarkdownFilesShared,
  toPosixPath,
} from '../../runtime/shared/path'
import {
  getFileTimestampFallbacks,
  normalizeTimestamp,
} from '../../runtime/shared/timestamp'
import { validateEntryName } from '../../runtime/validation'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  NOTES_INBOX_RELATIVE_PATH,
  NOTES_TRASH_RELATIVE_PATH,
  notesRuntimeRef,
  TRASH_DIR_NAME,
} from './constants'
import { buildNotesFolderPathMap, buildPathToNotesFolderIdMap } from './paths'

export const NOTE_SYSTEM_FRONTMATTER_KEYS = new Set([
  'createdAt',
  'description',
  'folderId',
  'id',
  'isDeleted',
  'isFavorites',
  'name',
  'tags',
  'updatedAt',
])

export function isNoteSystemFrontmatterKey(key: string): boolean {
  return NOTE_SYSTEM_FRONTMATTER_KEYS.has(key)
}

function extractNoteProperties(frontmatter: NotesFrontmatter): NoteProperties {
  return Object.fromEntries(
    Object.entries(frontmatter).filter(
      ([key]) => !NOTE_SYSTEM_FRONTMATTER_KEYS.has(key),
    ),
  )
}

export function toNoteFileName(name: string): string {
  const normalized = validateEntryName(name, 'note')

  if (normalized.toLowerCase().endsWith('.md')) {
    return normalized
  }

  return `${normalized}.md`
}

export function serializeNote(note: MarkdownNote): string {
  const frontmatter: NotesFrontmatter & NoteProperties = {
    createdAt: note.createdAt,
    description: note.description,
    folderId: note.folderId,
    id: note.id,
    isDeleted: note.isDeleted,
    isFavorites: note.isFavorites,
    name: note.name,
    tags: note.tags,
    updatedAt: note.updatedAt,
    ...note.properties,
  }

  const frontmatterText = yaml
    .dump(frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  if (!note.content) {
    return `---\n${frontmatterText}\n---\n`
  }

  return `---\n${frontmatterText}\n---\n${note.content}`
}

// Метаданные индекса собираются только по реально прочитанному файлу, а
// stat-сигнатура — по stat до чтения. Записи приложения не обновляют meta:
// изменённый mtime просто заставит перечитать файл на следующем старте.
export function buildNoteIndexMetadata(
  note: MarkdownNote,
  stats: { mtimeMs: number, size: number },
): NotesIndexMetadata {
  return {
    createdAt: note.createdAt,
    description: note.description,
    folderId: note.folderId,
    isDeleted: note.isDeleted,
    isFavorites: note.isFavorites,
    mtimeMs: stats.mtimeMs,
    name: note.name,
    properties: { ...note.properties },
    size: stats.size,
    tags: [...note.tags],
    updatedAt: note.updatedAt,
  }
}

// state.json синхронизируется между устройствами и правится извне, поэтому
// метаданные индекса перед использованием проверяются по форме: битая запись
// не роняет скан, файл просто перечитывается.
function isValidNoteIndexMetadata(
  meta: NotesIndexMetadata | undefined,
): meta is NotesIndexMetadata {
  return (
    !!meta
    && typeof meta === 'object'
    && typeof meta.name === 'string'
    && Array.isArray(meta.tags)
    && !!meta.properties
    && typeof meta.properties === 'object'
    && typeof meta.mtimeMs === 'number'
    && Number.isFinite(meta.mtimeMs)
    && typeof meta.size === 'number'
    && Number.isFinite(meta.size)
    && typeof meta.createdAt === 'number'
    && typeof meta.updatedAt === 'number'
  )
}

export function hasFreshNoteIndexMetadata(
  entry: NotesIndexItem,
  stats: { mtimeMs: number, size: number } | null,
): boolean {
  return (
    !!stats
    && isValidNoteIndexMetadata(entry.meta)
    && entry.meta.mtimeMs === stats.mtimeMs
    && entry.meta.size === stats.size
  )
}

// Запись списка из метаданных индекса, без чтения файла: тело остаётся
// content: null и дочитывается лениво (ensureNoteContentLoaded).
export function buildNoteFromIndexMetadata(
  entry: NotesIndexItem,
  meta: NotesIndexMetadata,
  options?: { pendingCloudDownload?: boolean },
): MarkdownNote {
  const isTrashed = entry.filePath.startsWith(`${NOTES_TRASH_RELATIVE_PATH}/`)

  return {
    content: null,
    createdAt: meta.createdAt,
    description: meta.description ?? null,
    filePath: entry.filePath,
    // folderId в meta — как его разрешило последнее чтение (frontmatter
    // приоритетнее пути, см. readNoteFromFile).
    folderId: meta.folderId ?? null,
    id: entry.id,
    isDeleted: isTrashed ? 1 : normalizeFlag(meta.isDeleted),
    isFavorites: normalizeFlag(meta.isFavorites),
    name: meta.name,
    ...(options?.pendingCloudDownload ? { pendingCloudDownload: true } : {}),
    properties: { ...meta.properties },
    tags: meta.tags.filter(tagId => typeof tagId === 'number' && tagId > 0),
    updatedAt: meta.updatedAt,
  }
}

// Дочитывает тело заметки, построенной из индекса. Заполняется только
// content === null: метаданные runtime-объекта авторитетны и могут содержать
// ещё не сохранённые правки. Возвращает false, если содержимое сейчас
// недоступно (плейсхолдер, сбой чтения).
export function ensureNoteContentLoaded(
  paths: NotesPaths,
  note: MarkdownNote,
): boolean {
  if (note.pendingCloudDownload) {
    return false
  }

  if (note.content !== null) {
    return true
  }

  const absolutePath = path.join(paths.notesRoot, note.filePath)
  const availability = getFileAvailability(absolutePath)

  if (!availability.exists) {
    return false
  }

  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    return false
  }

  let source: string
  try {
    source = fs.readFileSync(absolutePath, 'utf8')
  }
  catch (error) {
    log('storage:notes:load-note-content', error)
    enqueueCloudDownload(absolutePath)
    return false
  }

  note.content = splitFrontmatter(source).body
  return true
}

// Дочитывает тела всех ленивых заметок: нужно потокам, которые читают
// content поперёк всего пространства (поиск, graph, dashboard, backlinks).
export function ensureAllNoteContentsLoaded(
  paths: NotesPaths,
  notes: MarkdownNote[],
): boolean {
  let hasLoadedContent = false

  for (const note of notes) {
    if (
      !note.pendingCloudDownload
      && note.content === null
      && ensureNoteContentLoaded(paths, note)
    ) {
      hasLoadedContent = true
    }
  }

  return hasLoadedContent
}

export function buildPlaceholderNote(
  entry: NotesIndexItem,
  pathToFolderIdMap: Map<string, number>,
  timestampFallbacks: { createdAt: number, updatedAt: number },
): MarkdownNote {
  const dirPath = toPosixPath(path.posix.dirname(entry.filePath))
  const folderId
    = dirPath && dirPath !== '.' && !dirPath.startsWith('.masscode')
      ? (pathToFolderIdMap.get(dirPath) ?? null)
      : null

  return {
    content: '',
    createdAt: timestampFallbacks.createdAt,
    description: null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: entry.filePath.startsWith(`${NOTES_TRASH_RELATIVE_PATH}/`)
      ? 1
      : 0,
    isFavorites: 0,
    name: path.basename(entry.filePath, '.md'),
    pendingCloudDownload: true,
    properties: {},
    tags: [],
    updatedAt: timestampFallbacks.updatedAt,
  }
}

export function readNoteFromFile(
  paths: NotesPaths,
  entry: NotesIndexItem,
  pathToFolderIdMap: Map<string, number>,
): MarkdownNote | null {
  const absolutePath = path.join(paths.notesRoot, entry.filePath)
  const availability = getFileAvailability(absolutePath)

  if (!availability.exists) {
    return null
  }

  const readNow = Date.now()
  const placeholderTimestamps = getFileTimestampFallbacks(
    absolutePath,
    readNow,
    availability.stats,
  )

  let source: string | null = null

  if (!availability.isCloudPlaceholder) {
    try {
      source = fs.readFileSync(absolutePath, 'utf8')
    }
    catch (error) {
      // Сорвавшееся чтение не валит весь скан: заметка обрабатывается как
      // недокачанная.
      log('storage:notes:read-note', error)
    }
  }

  // Плейсхолдер (или файл со сбоем чтения) не читается синхронно: заметка
  // сразу видна в списке по данным индекса и имени файла, содержимое
  // докачивается в фоне.
  if (source === null) {
    enqueueCloudDownload(absolutePath)

    return buildPlaceholderNote(
      entry,
      pathToFolderIdMap,
      placeholderTimestamps,
    )
  }

  const { body, frontmatter, hasFrontmatter } = splitFrontmatter(source)
  const fm = frontmatter as NotesFrontmatter
  const now = Date.now()
  const timestampFallbacks = getFileTimestampFallbacks(
    absolutePath,
    now,
    availability.stats,
  )

  // Infer folderId from file path if not in frontmatter
  let folderId: number | null = fm.folderId ?? null
  if (folderId === null || folderId === undefined) {
    const dirPath = toPosixPath(path.posix.dirname(entry.filePath))
    if (dirPath && dirPath !== '.' && !dirPath.startsWith('.masscode')) {
      folderId = pathToFolderIdMap.get(dirPath) ?? null
    }
  }

  const note: MarkdownNote = {
    content: body,
    createdAt: normalizeTimestamp(fm.createdAt, timestampFallbacks.createdAt),
    description: fm.description ?? null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: normalizeFlag(fm.isDeleted),
    isFavorites: normalizeFlag(fm.isFavorites),
    name: fm.name || path.basename(entry.filePath, '.md'),
    properties: extractNoteProperties(fm),
    tags: Array.isArray(fm.tags)
      ? fm.tags.filter(t => typeof t === 'number')
      : [],
    updatedAt: normalizeTimestamp(fm.updatedAt, timestampFallbacks.updatedAt),
  }

  if (!hasFrontmatter) {
    writeNoteToFile(paths, note)
  }

  return note
}

export function writeNoteToFile(paths: NotesPaths, note: MarkdownNote): void {
  const absolutePath = path.join(paths.notesRoot, note.filePath)

  // Запись в плейсхолдер уничтожила бы ещё не скачанное облачное
  // содержимое, поэтому она запрещена: файл сначала докачивается в фоне.
  const availability = getFileAvailability(absolutePath)
  if (note.pendingCloudDownload || availability.isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    return
  }

  // Ленивая запись (тело ещё не дочитано из индекса): content дочитывается
  // с диска перед сериализацией, иначе запись затёрла бы тело пустым.
  if (!ensureNoteContentLoaded(paths, note)) {
    return
  }

  const nextContent = serializeNote(note)

  if (availability.exists) {
    const currentContent = fs.readFileSync(absolutePath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, nextContent, 'utf8')
  rememberAppFileChange(absolutePath)
}

export function loadNotes(
  paths: NotesPaths,
  state: NotesState,
): MarkdownNote[] {
  const pathToFolderIdMap = buildPathToNotesFolderIdMap(state)
  const notes: MarkdownNote[] = []

  for (const entry of state.notes) {
    const absolutePath = path.join(paths.notesRoot, entry.filePath)
    const availability = getFileAvailability(absolutePath)

    if (!availability.exists) {
      continue
    }

    // Свежая stat-сигнатура: запись строится из индекса без чтения файла,
    // тело дочитывается лениво по первому обращению.
    if (
      !availability.isCloudPlaceholder
      && hasFreshNoteIndexMetadata(entry, availability.stats)
    ) {
      notes.push(buildNoteFromIndexMetadata(entry, entry.meta!))
      continue
    }

    // Плейсхолдер с известными метаданными: полноценная запись списка без
    // чтения (и без сетевой материализации), контент докачивается в фоне.
    if (
      availability.isCloudPlaceholder
      && isValidNoteIndexMetadata(entry.meta)
    ) {
      enqueueCloudDownload(absolutePath)
      notes.push(
        buildNoteFromIndexMetadata(entry, entry.meta, {
          pendingCloudDownload: true,
        }),
      )
      continue
    }

    const note = readNoteFromFile(paths, entry, pathToFolderIdMap)
    if (!note) {
      continue
    }

    // Индекс обновляется только по реально прочитанному файлу.
    if (!note.pendingCloudDownload && availability.stats) {
      entry.meta = buildNoteIndexMetadata(note, availability.stats)
    }

    notes.push(note)
  }

  return notes
}

function getNoteTargetDirectory(
  state: NotesState,
  note: MarkdownNote,
  folderPathMap?: Map<number, string>,
): string {
  if (note.isDeleted) {
    return NOTES_TRASH_RELATIVE_PATH
  }

  if (note.folderId === null) {
    return NOTES_INBOX_RELATIVE_PATH
  }

  const resolvedFolderPathMap = folderPathMap ?? buildNotesFolderPathMap(state)
  const folderPath = resolvedFolderPathMap.get(note.folderId)

  return folderPath || NOTES_INBOX_RELATIVE_PATH
}

export function buildNoteTargetPath(
  state: NotesState,
  note: MarkdownNote,
  folderPathMap?: Map<number, string>,
): string {
  const directory = getNoteTargetDirectory(state, note, folderPathMap)
  const fileName = toNoteFileName(note.name)
  return path.posix.join(directory, fileName)
}

function getUniqueNotePath(
  paths: NotesPaths,
  targetPath: string,
  currentFilePath: string | null,
  directoryEntriesCache?: Map<string, string[]>,
): string {
  const targetAbsolutePath = path.join(paths.notesRoot, targetPath)
  const targetDirectory = path.dirname(targetAbsolutePath)
  const targetFileName = path.basename(targetAbsolutePath)
  const currentAbsolutePath = currentFilePath
    ? path.join(paths.notesRoot, currentFilePath)
    : null

  fs.ensureDirSync(targetDirectory)

  const entries = getCachedDirectoryEntries(
    targetDirectory,
    directoryEntriesCache,
  )
  const hasCaseInsensitiveConflict = (candidateFileName: string): boolean =>
    entries.some((entry) => {
      const entryAbsolutePath = path.join(targetDirectory, entry)

      if (
        currentAbsolutePath
        && entryAbsolutePath.toLowerCase() === currentAbsolutePath.toLowerCase()
      ) {
        return false
      }

      return entry.toLowerCase() === candidateFileName.toLowerCase()
    })

  if (!hasCaseInsensitiveConflict(targetFileName)) {
    return targetPath
  }

  const dir = path.posix.dirname(targetPath)
  const ext = path.posix.extname(targetPath)
  const baseName = path.posix.basename(targetPath, ext)

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidateFileName = `${baseName} ${suffix}${ext}`

    if (!hasCaseInsensitiveConflict(candidateFileName)) {
      return path.posix.join(dir, candidateFileName)
    }
  }

  throw new Error('NAME_CONFLICT:Cannot generate unique note file name')
}

export function persistNote(
  paths: NotesPaths,
  state: NotesState,
  note: MarkdownNote,
  previousFilePath?: string,
  options?: PersistNoteOptions,
): void {
  const targetPath = buildNoteTargetPath(state, note, options?.folderPathMap)
  const currentFilePath = previousFilePath || note.filePath
  const directoryEntriesCache = options?.directoryEntriesCache

  let resolvedPath: string
  if (options?.allowRenameOnConflict) {
    resolvedPath = getUniqueNotePath(
      paths,
      targetPath,
      currentFilePath,
      directoryEntriesCache,
    )
    if (resolvedPath !== targetPath) {
      note.name = path.posix.basename(resolvedPath, '.md')
    }
  }
  else {
    resolvedPath = targetPath
  }

  const resolvedAbsolutePath = path.join(paths.notesRoot, resolvedPath)

  // Move file if path changed
  if (currentFilePath && currentFilePath !== resolvedPath) {
    const currentAbsolutePath = path.join(paths.notesRoot, currentFilePath)
    if (fs.pathExistsSync(currentAbsolutePath)) {
      fs.ensureDirSync(path.dirname(resolvedAbsolutePath))
      fs.moveSync(currentAbsolutePath, resolvedAbsolutePath, {
        overwrite: false,
      })
      rememberAppFileChange(currentAbsolutePath)
      rememberAppFileChange(resolvedAbsolutePath)
      removeDirectoryEntryFromCache(
        path.dirname(currentAbsolutePath),
        path.basename(currentAbsolutePath),
        directoryEntriesCache,
      )
    }
  }

  note.filePath = resolvedPath

  // Update state index
  const indexEntry = state.notes.find(n => n.id === note.id)
  if (indexEntry) {
    indexEntry.filePath = resolvedPath
  }
  else {
    state.notes.push({ id: note.id, filePath: resolvedPath })
  }

  // Write content
  writeNoteToFile(paths, note)
  upsertDirectoryEntryInCache(
    path.dirname(resolvedAbsolutePath),
    path.basename(resolvedAbsolutePath),
    directoryEntriesCache,
  )
}

export function findNoteById(
  notes: MarkdownNote[],
  id: number,
): MarkdownNote | undefined {
  const cache = notesRuntimeRef.cache
  if (cache) {
    if (cache.noteById.size !== cache.notes.length) {
      cache.noteById = new Map(cache.notes.map(n => [n.id, n]))
    }

    const noteFromCache = cache.noteById.get(id)
    if (noteFromCache) {
      return noteFromCache
    }
  }

  const note = notes.find(n => n.id === id)
  if (note && cache) {
    cache.noteById.set(id, note)
  }

  return note
}

export function listNoteMarkdownFiles(notesRoot: string): string[] {
  return listMarkdownFilesShared(
    notesRoot,
    META_DIR_NAME,
    INBOX_DIR_NAME,
    TRASH_DIR_NAME,
  )
}
