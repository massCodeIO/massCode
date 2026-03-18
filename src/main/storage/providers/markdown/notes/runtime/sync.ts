import type {
  MarkdownNote,
  NotesFolderDiskEntry,
  NotesFolderRecord,
  NotesPaths,
  NotesRuntimeCache,
  NotesState,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import {
  normalizeFlag,
  normalizeFolderOrderIndices,
  normalizeNumber,
} from '../../runtime/normalizers'
import { notesRuntimeRef } from './constants'
import { listNoteMarkdownFiles, loadNotes } from './notes'
import {
  readNotesFolderMetadata,
  writeNotesFolderMetadataFile,
} from './parser'
import { buildNotesFolderPathMap } from './paths'
import { buildNotesSearchIndex } from './search'
import { loadNotesState, saveNotesState } from './state'

function toPosixPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

function depthOfRelativePath(relativePath: string): number {
  if (!relativePath) {
    return 0
  }
  return relativePath.split('/').length
}

function listUserFolders(
  notesRoot: string,
  paths: NotesPaths,
): NotesFolderDiskEntry[] {
  const result: NotesFolderDiskEntry[] = []

  function walk(dir: string, relativeDir: string): void {
    if (!fs.pathExistsSync(dir)) {
      return
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const entryName = entry.name

      // Skip hidden and technical directories
      if (entryName.startsWith('.')) {
        continue
      }

      const entryRelativePath = relativeDir
        ? `${relativeDir}/${entryName}`
        : entryName

      result.push({
        metadata: {},
        path: entryRelativePath,
      })

      walk(path.join(dir, entryName), entryRelativePath)
    }
  }

  walk(notesRoot, '')

  // Read metadata for each folder
  for (const entry of result) {
    entry.metadata = readNotesFolderMetadata(paths, entry.path)
  }

  return result
}

export function syncNotesFoldersWithDisk(
  paths: NotesPaths,
  state: NotesState,
): void {
  const diskFolders = listUserFolders(paths.notesRoot, paths)

  // Sort by depth then name
  diskFolders.sort((a, b) => {
    const depthDiff = depthOfRelativePath(a.path) - depthOfRelativePath(b.path)
    if (depthDiff !== 0) {
      return depthDiff
    }
    return a.path.localeCompare(b.path)
  })

  const previousFolderById = new Map<number, NotesFolderRecord>()
  state.folders.forEach(f => previousFolderById.set(f.id, f))

  const resolvedIdByPath = new Map<string, number>()
  const usedIds = new Set<number>()
  const nextFolders: NotesFolderRecord[] = []
  const now = Date.now()

  for (const diskFolder of diskFolders) {
    const { metadata } = diskFolder
    const folderRelativePath = diskFolder.path

    // Resolve parent
    const parentPath = toPosixPath(path.posix.dirname(folderRelativePath))
    const parentId
      = parentPath === '.' ? null : (resolvedIdByPath.get(parentPath) ?? null)

    // Resolve ID
    let folderId: number | undefined
    if (metadata.id && !usedIds.has(metadata.id)) {
      folderId = metadata.id
    }

    if (!folderId) {
      state.counters.folderId += 1
      folderId = state.counters.folderId
    }

    usedIds.add(folderId)
    resolvedIdByPath.set(folderRelativePath, folderId)

    const folderName = path.posix.basename(folderRelativePath)
    const previousFolder = previousFolderById.get(folderId)
    const previousFolderUi = state.folderUi[String(folderId)]

    nextFolders.push({
      id: folderId,
      name: folderName,
      parentId,
      icon: metadata.icon ?? previousFolder?.icon ?? null,
      isOpen: previousFolderUi
        ? normalizeFlag(previousFolderUi.isOpen)
        : normalizeFlag(previousFolder?.isOpen, 0),
      orderIndex: normalizeNumber(
        metadata.orderIndex ?? previousFolder?.orderIndex,
        0,
      ),
      createdAt: normalizeNumber(
        metadata.createdAt ?? previousFolder?.createdAt,
        now,
      ),
      updatedAt: normalizeNumber(
        metadata.updatedAt ?? previousFolder?.updatedAt,
        now,
      ),
    })
  }

  normalizeFolderOrderIndices(nextFolders as any)
  state.folders = nextFolders
}

export function syncNotesWithDisk(paths: NotesPaths, state: NotesState): void {
  const mdFiles = listNoteMarkdownFiles(paths.notesRoot)

  // Build existing path -> id map from state
  const existingByPath = new Map<string, number>()
  state.notes.forEach(entry => existingByPath.set(entry.filePath, entry.id))

  const nextNotes: { id: number, filePath: string }[] = []
  const usedIds = new Set<number>()

  for (const filePath of mdFiles) {
    let noteId = existingByPath.get(filePath)

    if (!noteId || usedIds.has(noteId)) {
      // Try reading frontmatter for id
      const absolutePath = path.join(paths.notesRoot, filePath)
      try {
        const source = fs.readFileSync(absolutePath, 'utf8')
        const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
        if (match) {
          const fm = yaml.load(match[1]) as any
          if (fm?.id && typeof fm.id === 'number' && !usedIds.has(fm.id)) {
            noteId = fm.id
          }
        }
      }
      catch {
        // ignore
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

function syncNotesFolderMetadataFiles(
  paths: NotesPaths,
  state: NotesState,
): void {
  const folderPathMap = buildNotesFolderPathMap(state)

  for (const folder of state.folders) {
    const folderPath = folderPathMap.get(folder.id)
    if (folderPath) {
      writeNotesFolderMetadataFile(paths, folderPath, folder)
    }
  }
}

function setNotesRuntimeCache(
  paths: NotesPaths,
  state: NotesState,
  notes: MarkdownNote[],
): NotesRuntimeCache {
  const folderById = new Map(state.folders.map(f => [f.id, f]))
  const noteById = new Map(notes.map(n => [n.id, n]))

  const searchIndex = buildNotesSearchIndex(notes)

  const cache: NotesRuntimeCache = {
    folderById,
    noteById,
    notes,
    paths,
    searchIndexDirty: false,
    searchNoteTextById: searchIndex.searchNoteTextById,
    searchQueryCache: new Map(),
    searchTokenToNoteIds: searchIndex.searchTokenToNoteIds,
    searchTokensByNoteId: searchIndex.searchTokensByNoteId,
    state,
  }

  notesRuntimeRef.cache = cache
  return cache
}

export function syncNotesRuntimeWithDisk(paths: NotesPaths): NotesRuntimeCache {
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
