import type {
  MarkdownNote,
  NotesFolderMetadataFile,
  NotesFolderRecord,
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
import { normalizeDirectoryPath, toPosixPath } from '../../runtime/shared/path'
import { createVaultReconciler } from '../../runtime/shared/vaultReconcile'
import {
  NOTES_INBOX_RELATIVE_PATH,
  NOTES_TRASH_RELATIVE_PATH,
  notesRuntimeRef,
} from './constants'
import {
  buildPlaceholderNote,
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

  // Build existing path -> id map from state
  const existingByPath = new Map<string, number>()
  state.notes.forEach(entry => existingByPath.set(entry.filePath, entry.id))

  const nextNotes: { id: number, filePath: string }[] = []
  const usedIds = new Set<number>()

  for (const filePath of mdFiles) {
    let noteId = existingByPath.get(filePath)

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
    nextNotes.push({ id: noteId, filePath })
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

// Мгновенный кэш из state-индекса без единого обращения к файлам заметок:
// все записи помечены недокачанными, содержимое и уточнение статусов
// приходят после фоновой сверки с диском.
function buildProvisionalNotesCache(paths: NotesPaths): NotesRuntimeCache {
  if (
    notesRuntimeRef.cache
    && notesRuntimeRef.cache.paths.notesRoot === paths.notesRoot
  ) {
    return notesRuntimeRef.cache
  }

  const state = loadNotesState(paths)
  const pathToFolderIdMap = buildPathToNotesFolderIdMap(state)
  const now = Date.now()
  const notes = state.notes.map(entry =>
    buildPlaceholderNote(entry, pathToFolderIdMap, {
      createdAt: now,
      updatedAt: now,
    }),
  )

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

      syncNotesRuntimeWithDisk(paths)
    })

    return provisionalCache
  }

  flushPendingNotesStateWrite(paths)
  const state = loadNotesState(paths)

  syncNotesFoldersWithDisk(paths, state)
  syncNotesWithDisk(paths, state)
  syncNotesCounters(state)

  saveNotesState(paths, state, { immediate: true })
  syncNotesFolderMetadataFiles(paths, state)

  const notes = loadNotes(paths, state)

  return setNotesRuntimeCache(paths, state, notes)
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
