import type { FolderRecord } from '../../../contracts'
import type {
  MarkdownFolderMetadataFile,
  MarkdownRuntimeCache,
  MarkdownSnippet,
  MarkdownState,
  Paths,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { runtimeRef } from './cache'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  SPACES_DIR_NAME,
  TRASH_DIR_NAME,
} from './constants'
import { readFolderMetadata, writeFolderMetadataFile } from './parser'
import {
  buildFolderPathMap,
  buildPathToFolderIdMap,
  findFolderById,
  normalizeDirectoryPath,
  toPosixPath,
} from './paths'
import { buildSearchIndex, getSnippetSearchText } from './search'
import {
  syncFolderMetadataFilesByPathMap,
  syncFoldersStateFromDiskAtRoot,
} from './shared/folderSync'
import { syncFolderUiWithFolders } from './shared/stateUtils'
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
} from './state'

function isTechnicalRootFolder(name: string): boolean {
  return (
    name === META_DIR_NAME
    || name === INBOX_DIR_NAME
    || name === TRASH_DIR_NAME
    || name === SPACES_DIR_NAME
  )
}

function syncFoldersWithDisk(paths: Paths, state: MarkdownState): void {
  syncFoldersStateFromDiskAtRoot<FolderRecord, MarkdownFolderMetadataFile>({
    buildFolder: ({ base, metadata, previousFolder }) => {
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

      return {
        ...base,
        defaultLanguage,
        icon,
      }
    },
    readMetadata: relativePath => readFolderMetadata(paths, relativePath),
    rootPath: paths.vaultPath,
    shouldSkipDirectory: ({ entryName, isRoot }) =>
      isRoot && isTechnicalRootFolder(entryName),
    state,
  })
  syncFolderUiWithFolders(state)
}

export function syncFolderMetadataFiles(
  paths: Paths,
  state: MarkdownState,
): void {
  const folderPathMap = buildFolderPathMap(state)
  syncFolderMetadataFilesByPathMap(
    state.folders,
    folderPathMap,
    (folderPath, folder) => {
      const syncedFolder = findFolderById(state, folder.id)
      if (syncedFolder) {
        writeFolderMetadataFile(paths, folderPath, syncedFolder)
      }
    },
  )
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

  runtimeRef.cache = {
    contentOwnerByContentId,
    folderById,
    paths,
    searchIndex: buildSearchIndex(snippets, getSnippetSearchText),
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
