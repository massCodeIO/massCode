import type {
  MarkdownNote,
  NotesFolderMetadataFile,
  NotesFolderRecord,
  NotesIndexItem,
  NotesPaths,
  NotesRuntimeCache,
  NotesState,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { enqueueCloudDownload } from '../../cloudDownloads'
import {
  getFileAvailability,
  primeDatalessChecks,
} from '../../runtime/shared/cloudFiles'
import {
  syncFolderMetadataFilesByPathMap,
  syncFoldersStateFromDiskAtRoot,
} from '../../runtime/shared/folderSync'
import { isCloudFileNotDownloadedError } from '../../runtime/shared/guardedRead'
import { normalizeDirectoryPath, toPosixPath } from '../../runtime/shared/path'
import { createVaultReconciler } from '../../runtime/shared/vaultReconcile'
import {
  applyDeferredBacklinkRewrites,
  clearDeferredBacklinkRewrites,
} from './backlinks'
import {
  NOTES_INBOX_RELATIVE_PATH,
  NOTES_TRASH_RELATIVE_PATH,
  notesRuntimeRef,
} from './constants'
import {
  buildNoteIndexMetadata,
  listNoteMarkdownFiles,
  loadNotes,
  readNoteFromFile,
} from './notes'
import {
  readNotesFolderMetadata,
  writeNotesFolderMetadataFile,
} from './parser'
import { buildNotesFolderPathMap, buildPathToNotesFolderIdMap } from './paths'
import { buildNoteSearchText, buildSearchIndex } from './search'
import {
  createDefaultNotesState,
  flushPendingNotesStateWrite,
  loadNotesState,
  saveNotesState,
} from './state'

export function syncNotesFoldersWithDisk(
  paths: NotesPaths,
  state: NotesState,
): void {
  syncFoldersStateFromDiskAtRoot<NotesFolderRecord, NotesFolderMetadataFile>({
    buildFolder: ({ base, metadata, previousFolder }) => ({
      ...base,
      icon:
        metadata.icon === null
          ? null
          : typeof metadata.icon === 'string'
            ? metadata.icon
            : (previousFolder?.icon ?? null),
    }),
    readMetadata: relativePath =>
      readNotesFolderMetadata(paths, relativePath),
    rootPath: paths.notesRoot,
    shouldSkipDirectory: ({ entryName }) => entryName.startsWith('.'),
    state,
  })
}

// 'unreadable' означает, что содержимое файла сейчас недоступно (облачный
// плейсхолдер или сбой чтения): каллеры обязаны пропустить такой файл до
// фоновой докачки, а не чеканить для него новый id.
function readNoteIdFromFrontmatter(
  absolutePath: string,
): number | null | 'unreadable' {
  if (getFileAvailability(absolutePath).isCloudPlaceholder) {
    return 'unreadable'
  }

  try {
    const source = fs.readFileSync(absolutePath, 'utf8')
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) {
      return null
    }

    const fm = yaml.load(match[1]) as { id?: unknown } | null
    return fm && typeof fm.id === 'number' && fm.id ? fm.id : null
  }
  catch {
    return 'unreadable'
  }
}

export function syncNotesWithDisk(paths: NotesPaths, state: NotesState): void {
  const mdFiles = listNoteMarkdownFiles(paths.notesRoot)

  // Один batch-вызов точной проверки dataless на весь список вместо
  // отдельного системного вызова на каждый подозрительный файл.
  primeDatalessChecks(
    mdFiles.map(filePath => path.join(paths.notesRoot, filePath)),
  )

  // Build existing path -> entry map from state
  const existingByPath = new Map<string, NotesIndexItem>()
  state.notes.forEach(entry => existingByPath.set(entry.filePath, entry))

  const nextNotes: NotesIndexItem[] = []
  const usedIds = new Set<number>()

  for (const filePath of mdFiles) {
    const existingEntry = existingByPath.get(filePath)
    let noteId = existingEntry?.id

    if (!noteId || usedIds.has(noteId)) {
      const absolutePath = path.join(paths.notesRoot, filePath)
      const frontmatterId = readNoteIdFromFrontmatter(absolutePath)

      // Неизвестный файл, содержимое которого сейчас недоступно (облачный
      // плейсхолдер или сбой чтения): его frontmatter-id неизвестен, а
      // чеканка нового id дала бы расходящиеся id после докачки. Файл
      // появится в индексе после фоновой докачки.
      if (frontmatterId === 'unreadable') {
        enqueueCloudDownload(absolutePath)
        continue
      }

      if (frontmatterId && !usedIds.has(frontmatterId)) {
        noteId = frontmatterId
      }
    }

    if (!noteId || usedIds.has(noteId)) {
      state.counters.noteId += 1
      noteId = state.counters.noteId
    }

    usedIds.add(noteId)

    // Метаданные индекса переносятся только если запись осталась той же
    // (тот же путь и id): stat-сверка в loadNotes решит, актуальны ли они.
    const carriedMeta
      = existingEntry && existingEntry.id === noteId
        ? existingEntry.meta
        : undefined

    nextNotes.push({
      filePath,
      id: noteId,
      ...(carriedMeta ? { meta: carriedMeta } : {}),
    })
  }

  state.notes = nextNotes
}

function syncNotesCounters(state: NotesState): void {
  let maxFolderId = state.counters.folderId
  let maxNoteId = state.counters.noteId
  let maxTagId = state.counters.tagId

  for (const folder of state.folders) {
    if (folder.id > maxFolderId) {
      maxFolderId = folder.id
    }
  }

  for (const note of state.notes) {
    if (note.id > maxNoteId) {
      maxNoteId = note.id
    }
  }

  for (const tag of state.tags) {
    if (tag.id > maxTagId) {
      maxTagId = tag.id
    }
  }

  state.counters.folderId = maxFolderId
  state.counters.noteId = maxNoteId
  state.counters.tagId = maxTagId
}

export function syncNotesFolderMetadataFiles(
  paths: NotesPaths,
  state: NotesState,
): void {
  const folderPathMap = buildNotesFolderPathMap(state)
  syncFolderMetadataFilesByPathMap(
    state.folders,
    folderPathMap,
    (folderPath, folder) =>
      writeNotesFolderMetadataFile(paths, folderPath, folder),
  )
}

function setNotesRuntimeCache(
  paths: NotesPaths,
  state: NotesState,
  notes: MarkdownNote[],
): NotesRuntimeCache {
  const folderById = new Map(state.folders.map(f => [f.id, f]))
  const noteById = new Map(notes.map(n => [n.id, n]))

  const cache: NotesRuntimeCache = {
    folderById,
    noteById,
    notes,
    paths,
    searchIndex: buildSearchIndex(notes, buildNoteSearchText),
    state,
  }

  notesRuntimeRef.cache = cache
  return cache
}

const notesVaultReconciler = createVaultReconciler('notes')

// Полные обходы диска (например, Vault Doctor) допустимы только после
// фоновой сверки: до неё листинги каталогов могут блокироваться сетью.
export function isNotesVaultDiskReady(paths: NotesPaths): boolean {
  return notesVaultReconciler.isReconciled(paths.notesRoot)
}

// Пустой временный кэш на период фоновой сверки: см. комментарий у
// buildProvisionalRuntimeCache. Список из state-индекса тут не строится,
// чтобы клик по ещё не подтянутой из облака записи не давал 404. Сам state
// при этом читается с диска: мутации в этот период работают с настоящими
// счётчиками и тегами, а не чеканят id заново поверх существующего индекса.
function buildProvisionalNotesCache(paths: NotesPaths): NotesRuntimeCache {
  if (
    notesRuntimeRef.cache
    && notesRuntimeRef.cache.paths.notesRoot === paths.notesRoot
  ) {
    return notesRuntimeRef.cache
  }

  // state.json сам может быть облачным плейсхолдером: тогда loadNotesState
  // бросает, а кэш строится на неперсистируемом дефолтном state (флаг
  // provisional блокирует запись и мутации до докачки).
  let state: NotesState
  try {
    state = loadNotesState(paths)
  }
  catch (error) {
    if (!isCloudFileNotDownloadedError(error)) {
      throw error
    }

    state = createDefaultNotesState()
    state.provisional = true
  }

  return setNotesRuntimeCache(paths, state, [])
}

// Настоящая сверка с диском: может бросить, если .state.yaml сам недокачан
// из облака (reconciler ретраит по этой ошибке).
function performFullNotesSync(paths: NotesPaths): NotesRuntimeCache {
  flushPendingNotesStateWrite(paths)
  const state = loadNotesState(paths)

  syncNotesFoldersWithDisk(paths, state)
  syncNotesWithDisk(paths, state)
  syncNotesCounters(state)
  syncNotesFolderMetadataFiles(paths, state)

  // State сохраняется после loadNotes: чтение файлов дозаполняет индекс
  // метаданных, и он должен доехать до диска в этом же сохранении.
  const notes = loadNotes(paths, state)

  // Заметки, гидрированные этим сканом, получают rewrite'ы ссылок,
  // отложенные на время докачки.
  for (const note of notes) {
    applyDeferredBacklinkRewrites(paths, state, note)
  }

  saveNotesState(paths, state, { immediate: true })

  return setNotesRuntimeCache(paths, state, notes)
}

export function syncNotesRuntimeWithDisk(paths: NotesPaths): NotesRuntimeCache {
  // Первый доступ к vault: обход диска опасен синхронно (листинги
  // dataless-каталогов материализуются сетью), поэтому мгновенно отдаётся
  // provisional-кэш, а настоящая сверка выполняется в фоне.
  if (!notesVaultReconciler.isReconciled(paths.notesRoot)) {
    const provisionalCache = buildProvisionalNotesCache(paths)

    notesVaultReconciler.begin(paths.notesRoot, () => {
      if (
        notesRuntimeRef.cache
        && notesRuntimeRef.cache.paths.notesRoot !== paths.notesRoot
      ) {
        return
      }

      performFullNotesSync(paths)
    })

    return provisionalCache
  }

  return performFullNotesSync(paths)
}

// Перепроверка недокачанных заметок независимо от fs-событий: см.
// комментарий у refreshPendingSnippetFiles.
export function refreshPendingNoteFiles(paths: NotesPaths): {
  changed: boolean
  remaining: number
} {
  const cache = notesRuntimeRef.cache
  if (!cache || cache.paths.notesRoot !== paths.notesRoot) {
    return { changed: false, remaining: 0 }
  }

  const pendingFilePaths = cache.notes
    .filter(note => note.pendingCloudDownload)
    .map(note => note.filePath)

  let changed = false
  for (const filePath of pendingFilePaths) {
    const absolutePath = path.join(paths.notesRoot, filePath)
    if (getFileAvailability(absolutePath).isCloudPlaceholder) {
      continue
    }

    if (syncNoteFileWithDisk(paths, filePath)) {
      changed = true
    }
  }

  const remaining
    = notesRuntimeRef.cache?.notes.filter(note => note.pendingCloudDownload)
      .length ?? 0

  return { changed, remaining }
}

export function getNotesRuntimeCache(paths: NotesPaths): NotesRuntimeCache {
  if (
    notesRuntimeRef.cache
    && notesRuntimeRef.cache.paths.notesRoot === paths.notesRoot
  ) {
    return notesRuntimeRef.cache
  }

  return syncNotesRuntimeWithDisk(paths)
}

export function resetNotesRuntimeCache(): void {
  notesRuntimeRef.cache = null
  // Отложенные backlink-rewrite'ы адресуются id заметок текущего vault:
  // при сбросе кэша (смена vault) они теряют смысл.
  clearDeferredBacklinkRewrites()
}

function commitNotesRuntimeCache(cache: NotesRuntimeCache): NotesRuntimeCache {
  // A new object identity signals watcher consumers that data changed,
  // while built maps and the lazily rebuilt search index are reused.
  notesRuntimeRef.cache = { ...cache }
  return notesRuntimeRef.cache
}

function isTechnicalNotesDirectory(directoryPath: string): boolean {
  return (
    directoryPath === NOTES_INBOX_RELATIVE_PATH
    || directoryPath.startsWith(`${NOTES_INBOX_RELATIVE_PATH}/`)
    || directoryPath === NOTES_TRASH_RELATIVE_PATH
    || directoryPath.startsWith(`${NOTES_TRASH_RELATIVE_PATH}/`)
  )
}

export function syncNoteFileWithDisk(
  paths: NotesPaths,
  changedFilePath: string,
): NotesRuntimeCache | null {
  const cache = notesRuntimeRef.cache
  if (!cache || cache.paths.notesRoot !== paths.notesRoot) {
    return null
  }

  // Provisional state (state.json ещё не докачан из облака) не может
  // регистрировать файлы: id выдавались бы с дефолтных счётчиков. Событие
  // не теряется — файл подберёт полная сверка после докачки.
  if (cache.state.provisional) {
    return cache
  }

  const normalizedFilePath = toPosixPath(changedFilePath).trim()
  if (
    !normalizedFilePath
    || path.posix.extname(normalizedFilePath).toLowerCase() !== '.md'
  ) {
    return null
  }

  const state = cache.state
  const notes = cache.notes
  const noteAbsolutePath = path.join(paths.notesRoot, normalizedFilePath)
  const normalizedDirectory = normalizeDirectoryPath(
    path.posix.dirname(normalizedFilePath),
  )
  const pathToFolderIdMap = buildPathToNotesFolderIdMap(state)

  if (
    normalizedDirectory
    && !isTechnicalNotesDirectory(normalizedDirectory)
    && !pathToFolderIdMap.has(normalizedDirectory)
  ) {
    return null
  }

  const normalizedFilePathKey = normalizedFilePath.toLowerCase()
  const noteIndexInState = state.notes.findIndex(
    entry => entry.filePath.toLowerCase() === normalizedFilePathKey,
  )
  const noteExistsOnDisk = fs.pathExistsSync(noteAbsolutePath)

  if (!noteExistsOnDisk) {
    if (noteIndexInState === -1) {
      return cache
    }

    const removedNoteId = state.notes[noteIndexInState].id
    state.notes.splice(noteIndexInState, 1)

    const noteIndexInRuntime = notes.findIndex(
      note => note.id === removedNoteId,
    )
    if (noteIndexInRuntime !== -1) {
      notes.splice(noteIndexInRuntime, 1)
    }
    cache.noteById.delete(removedNoteId)

    saveNotesState(paths, state)
    return commitNotesRuntimeCache(cache)
  }

  let noteIndexItem
    = noteIndexInState !== -1 ? state.notes[noteIndexInState] : null

  if (!noteIndexItem) {
    const frontmatterId = readNoteIdFromFrontmatter(noteAbsolutePath)

    // Неизвестный файл, содержимое которого сейчас недоступно (облачный
    // плейсхолдер или сбой чтения): регистрировать его нельзя, иначе id
    // был бы отчеканен вслепую и разошёлся бы с frontmatter-id после
    // докачки. Файл появится в индексе после фоновой докачки.
    if (frontmatterId === 'unreadable') {
      enqueueCloudDownload(noteAbsolutePath)
      return cache
    }

    let noteId = frontmatterId

    // Внешнее перемещение (mv A.md → B.md) может прислать add нового пути
    // раньше unlink старого: если frontmatter-id принадлежит записи, файла
    // которой уже нет на диске, это та же заметка — перенацеливаем запись,
    // сохраняя id, вместо аллокации нового.
    if (noteId) {
      const ownerEntry = state.notes.find(entry => entry.id === noteId)

      if (
        ownerEntry
        && !fs.pathExistsSync(path.join(paths.notesRoot, ownerEntry.filePath))
      ) {
        ownerEntry.filePath = normalizedFilePath
        noteIndexItem = ownerEntry
      }
    }

    if (!noteIndexItem) {
      const existingNoteIds = new Set<number>(
        state.notes.map(entry => entry.id),
      )

      if (!noteId || existingNoteIds.has(noteId)) {
        state.counters.noteId += 1
        noteId = state.counters.noteId
      }

      noteIndexItem = { filePath: normalizedFilePath, id: noteId }
      state.notes.push(noteIndexItem)
    }
  }
  else {
    noteIndexItem.filePath = normalizedFilePath
  }

  const syncedNote = readNoteFromFile(paths, noteIndexItem, pathToFolderIdMap)
  if (!syncedNote) {
    return null
  }

  if (!syncedNote.pendingCloudDownload) {
    // Заметка гидрирована: применяются rewrite'ы ссылок, отложенные на
    // время докачки (rename/move, случившиеся, пока тело было в облаке).
    applyDeferredBacklinkRewrites(paths, state, syncedNote)

    // Индекс метаданных обновляется по реально прочитанному файлу (stat
    // берётся после возможной записи отложенного rewrite), чтобы следующий
    // холодный старт собрал запись без чтения.
    const syncedStats = getFileAvailability(noteAbsolutePath).stats
    if (syncedStats) {
      noteIndexItem.meta = buildNoteIndexMetadata(syncedNote, syncedStats)
    }
  }

  const noteIndexInRuntime = notes.findIndex(
    note => note.id === syncedNote.id,
  )
  if (noteIndexInRuntime === -1) {
    notes.push(syncedNote)
  }
  else {
    notes[noteIndexInRuntime] = syncedNote
  }
  cache.noteById.set(syncedNote.id, syncedNote)

  if (syncedNote.id > state.counters.noteId) {
    state.counters.noteId = syncedNote.id
  }

  // saveNotesState marks the notes search index dirty, so it is rebuilt
  // lazily on the next search instead of eagerly on every file change.
  saveNotesState(paths, state)
  return commitNotesRuntimeCache(cache)
}
