import type { FolderRecord } from '../../../contracts'
import type {
  MarkdownFolderDiskEntry,
  MarkdownRuntimeCache,
  MarkdownSnippet,
  MarkdownState,
  Paths,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  runtimeRef,
  TRASH_DIR_NAME,
} from './constants'
import {
  normalizeFlag,
  normalizeNumber,
  normalizePositiveInteger,
} from './normalizers'
import { readFolderMetadata, writeFolderMetadataFile } from './parser'
import {
  buildFolderPathMap,
  buildPathToFolderIdMap,
  depthOfRelativePath,
  findFolderById,
  normalizeDirectoryPath,
  toPosixPath,
} from './paths'
import { buildSearchIndex } from './search'
import {
  getStateSnippetIndexByFilePath,
  isInboxSnippetDirectory,
  isTrashSnippetDirectory,
  listMarkdownFiles,
  loadSnippets,
  readFrontmatterIdFromSnippetFile,
  readSnippetFromFile,
} from './snippets'
import {
  flushPendingStateWrite,
  flushPendingStateWrites,
  loadState,
  saveState,
  syncFolderUiWithFolders,
} from './state'

export function listUserFolders(
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

export function syncFolderMetadataFiles(
  paths: Paths,
  state: MarkdownState,
): void {
  const folderPathMap = buildFolderPathMap(state)

  folderPathMap.forEach((folderPath, folderId) => {
    const folder = findFolderById(state, folderId)
    if (!folder) {
      return
    }

    writeFolderMetadataFile(paths, folderPath, folder)
  })
}

export function syncCounters(
  state: MarkdownState,
  snippets: MarkdownSnippet[],
): void {
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

export function syncStateWithDisk(paths: Paths): MarkdownState {
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

export function setRuntimeCache(
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

  runtimeRef.cache = {
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

  return runtimeRef.cache
}

export function resetRuntimeCache(): void {
  flushPendingStateWrites()
  runtimeRef.cache = null
}

export function syncRuntimeWithDisk(paths: Paths): MarkdownRuntimeCache {
  const state = syncStateWithDisk(paths)
  const snippets = loadSnippets(paths, state)

  return setRuntimeCache(paths, state, snippets)
}

export function getRuntimeCache(paths: Paths): MarkdownRuntimeCache {
  if (
    !runtimeRef.cache
    || runtimeRef.cache.paths.vaultPath !== paths.vaultPath
  ) {
    return syncRuntimeWithDisk(paths)
  }

  return runtimeRef.cache
}

export function syncSnippetFileWithDisk(
  paths: Paths,
  changedFilePath: string,
): MarkdownRuntimeCache | null {
  if (
    !runtimeRef.cache
    || runtimeRef.cache.paths.vaultPath !== paths.vaultPath
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

  const state = runtimeRef.cache.state
  const snippets = runtimeRef.cache.snippets
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
      return runtimeRef.cache
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
