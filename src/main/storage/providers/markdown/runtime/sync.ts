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
import { enqueueCloudDownload } from '../cloudDownloads'
import { runtimeRef } from './cache'
import { INBOX_DIR_NAME, META_DIR_NAME, TRASH_DIR_NAME } from './constants'
import {
  isFolderMetadataInSync,
  readFolderMetadata,
  writeFolderMetadataFile,
} from './parser'
import {
  buildFolderPathMap,
  buildPathToFolderIdMap,
  findFolderById,
  normalizeDirectoryPath,
  toPosixPath,
} from './paths'
import { buildSearchIndex, getSnippetSearchText } from './search'
import { getFileAvailability, primeDatalessChecks } from './shared/cloudFiles'
import {
  syncFolderMetadataFilesByPathMap,
  syncFoldersStateFromDiskAtRoot,
} from './shared/folderSync'
import { isCloudFileNotDownloadedError } from './shared/guardedRead'
import { syncFolderUiWithFolders } from './shared/stateUtils'
import { createVaultReconciler } from './shared/vaultReconcile'
import {
  buildPlaceholderSnippet,
  getStateSnippetIndexByFilePath,
  isInboxSnippetDirectory,
  isTrashSnippetDirectory,
  listMarkdownFiles,
  loadSnippets,
  readFrontmatterIdFromSnippetFile,
  readSnippetFromFile,
} from './snippets'
import {
  createDefaultState,
  flushPendingStateWrite,
  flushPendingStateWrites,
  loadState,
  saveState,
} from './state'

function isTechnicalRootFolder(name: string): boolean {
  return (
    name === META_DIR_NAME || name === INBOX_DIR_NAME || name === TRASH_DIR_NAME
  )
}

function syncFoldersWithDisk(
  paths: Paths,
  state: MarkdownState,
): Map<string, MarkdownFolderMetadataFile> {
  const diskFolders = syncFoldersStateFromDiskAtRoot<
    FolderRecord,
    MarkdownFolderMetadataFile
  >({
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

  return new Map(diskFolders.map(entry => [entry.path, entry.metadata]))
}

export function syncFolderMetadataFiles(
  paths: Paths,
  state: MarkdownState,
  scannedMetadataByPath?: ReadonlyMap<string, MarkdownFolderMetadataFile>,
): void {
  const folderPathMap = buildFolderPathMap(state)
  syncFolderMetadataFilesByPathMap(
    state.folders,
    folderPathMap,
    (folderPath, folder) => {
      const syncedFolder = findFolderById(state, folder.id)
      if (!syncedFolder) {
        return
      }

      const scannedMetadata = scannedMetadataByPath?.get(folderPath)
      if (
        scannedMetadata
        && isFolderMetadataInSync(scannedMetadata, syncedFolder)
      ) {
        return
      }

      writeFolderMetadataFile(paths, folderPath, syncedFolder)
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

function syncStateAndSnippetsWithDisk(
  paths: Paths,
  options?: { rewriteRecoveredLegacyFences?: boolean },
): { snippets: MarkdownSnippet[], state: MarkdownState } {
  flushPendingStateWrite(paths)

  const state = loadState(paths)
  const scannedFolderMetadataByPath = syncFoldersWithDisk(paths, state)

  const relativeSnippetFiles = listMarkdownFiles(paths.vaultPath)

  // Один batch-вызов точной проверки dataless на весь список вместо
  // отдельного системного вызова на каждый подозрительный файл.
  primeDatalessChecks(
    relativeSnippetFiles.map(filePath =>
      path.join(paths.vaultPath, filePath),
    ),
  )

  const fileSet = new Set(relativeSnippetFiles)
  const existingIdSet = new Set<number>(state.snippets.map(item => item.id))

  state.snippets = state.snippets.filter(item => fileSet.has(item.filePath))

  const knownSnippetFilePaths = new Set(
    state.snippets.map(item => item.filePath),
  )

  relativeSnippetFiles.forEach((filePath) => {
    if (knownSnippetFilePaths.has(filePath)) {
      return
    }

    const snippetAbsolutePath = path.join(paths.vaultPath, filePath)
    const frontmatterId = readFrontmatterIdFromSnippetFile(snippetAbsolutePath)

    // Неизвестный файл, содержимое которого сейчас недоступно (облачный
    // плейсхолдер или сбой чтения): его frontmatter-id неизвестен, а
    // чеканка нового id дала бы расходящиеся id после докачки. Файл
    // появится в индексе после фоновой докачки через инкрементальный sync.
    if (frontmatterId === 'unreadable') {
      enqueueCloudDownload(snippetAbsolutePath)
      return
    }

    let snippetId = frontmatterId

    if (!snippetId || existingIdSet.has(snippetId)) {
      snippetId = state.counters.snippetId + 1
      state.counters.snippetId = snippetId
    }

    existingIdSet.add(snippetId)
    state.snippets.push({ filePath, id: snippetId })
  })

  const snippets = loadSnippets(paths, state, options)
  syncCounters(state, snippets)
  syncFolderMetadataFiles(paths, state, scannedFolderMetadataByPath)
  saveState(paths, state, { immediate: true })

  return { snippets, state }
}

export function syncStateWithDisk(paths: Paths): MarkdownState {
  return syncStateAndSnippetsWithDisk(paths).state
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

const vaultReconciler = createVaultReconciler('markdown')

// Полные обходы диска (например, Vault Doctor) допустимы только после
// фоновой сверки: до неё листинги каталогов могут блокироваться сетью.
export function isCodeVaultDiskReady(paths: Paths): boolean {
  return vaultReconciler.isReconciled(paths.vaultPath)
}

// Мгновенный кэш из state-индекса без единого обращения к файлам vault:
// все записи помечены недокачанными, содержимое и уточнение статусов
// приходят после фоновой сверки с диском.
function buildProvisionalRuntimeCache(paths: Paths): MarkdownRuntimeCache {
  if (
    runtimeRef.cache
    && runtimeRef.cache.paths.vaultPath === paths.vaultPath
  ) {
    return runtimeRef.cache
  }

  // state.json сам может быть облачным плейсхолдером: тогда loadState
  // ставит его в приоритетную докачку и бросает. Provisional-кэш при этом
  // пустой (пространство откроется после докачки state и повторной сверки),
  // но приложение не фризит и не падает.
  let state: MarkdownState
  try {
    state = loadState(paths)
  }
  catch (error) {
    if (!isCloudFileNotDownloadedError(error)) {
      throw error
    }
    state = createDefaultState()
  }

  const pathToFolderIdMap = buildPathToFolderIdMap(state)
  const now = Date.now()
  const snippets = state.snippets.map(entry =>
    buildPlaceholderSnippet(entry, pathToFolderIdMap, {
      createdAt: now,
      updatedAt: now,
    }),
  )

  return setRuntimeCache(paths, state, snippets)
}

// Настоящая сверка с диском: читает state и файлы. Может бросить, если
// state.json сам недокачан из облака (reconciler ретраит по этой ошибке).
function performFullRuntimeSync(paths: Paths): MarkdownRuntimeCache {
  const { snippets, state } = syncStateAndSnippetsWithDisk(paths, {
    rewriteRecoveredLegacyFences: true,
  })

  return setRuntimeCache(paths, state, snippets)
}

export function syncRuntimeWithDisk(paths: Paths): MarkdownRuntimeCache {
  // Первый доступ к vault: обход диска опасен синхронно (листинги
  // dataless-каталогов материализуются сетью), поэтому мгновенно отдаётся
  // provisional-кэш, а настоящая сверка выполняется в фоне. Настоящая
  // сверка вызывается напрямую (не через syncRuntimeWithDisk), иначе до
  // пометки reconciled она снова ушла бы в provisional-ветку.
  if (!vaultReconciler.isReconciled(paths.vaultPath)) {
    const provisionalCache = buildProvisionalRuntimeCache(paths)

    vaultReconciler.begin(paths.vaultPath, () => {
      if (
        runtimeRef.cache
        && runtimeRef.cache.paths.vaultPath !== paths.vaultPath
      ) {
        return
      }

      performFullRuntimeSync(paths)
    })

    return provisionalCache
  }

  return performFullRuntimeSync(paths)
}

// Перепроверка недокачанных записей независимо от fs-событий: облачный
// провайдер (особенно iCloud) материализует файл, НЕ меняя mtime/size,
// поэтому chokidar не присылает `change` и флаг pendingCloudDownload иначе
// висел бы вечно. Возвращает, сколько записей всё ещё недокачано.
export function refreshPendingSnippetFiles(paths: Paths): {
  changed: boolean
  remaining: number
} {
  const cache = runtimeRef.cache
  if (!cache || cache.paths.vaultPath !== paths.vaultPath) {
    return { changed: false, remaining: 0 }
  }

  const pendingFilePaths = cache.snippets
    .filter(snippet => snippet.pendingCloudDownload)
    .map(snippet => snippet.filePath)

  let changed = false
  for (const filePath of pendingFilePaths) {
    const absolutePath = path.join(paths.vaultPath, filePath)
    if (getFileAvailability(absolutePath).isCloudPlaceholder) {
      continue
    }

    if (syncSnippetFileWithDisk(paths, filePath)) {
      changed = true
    }
  }

  const remaining
    = runtimeRef.cache?.snippets.filter(snippet => snippet.pendingCloudDownload)
      .length ?? 0

  return { changed, remaining }
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

function removeSnippetFromRuntimeMaps(
  cache: MarkdownRuntimeCache,
  snippet: MarkdownSnippet,
): void {
  cache.snippetById.delete(snippet.id)

  snippet.contents.forEach((content) => {
    const owner = cache.contentOwnerByContentId.get(content.id)
    if (owner && owner.snippet === snippet) {
      cache.contentOwnerByContentId.delete(content.id)
    }
  })
}

function upsertSnippetInRuntimeMaps(
  cache: MarkdownRuntimeCache,
  previousSnippet: MarkdownSnippet | null,
  snippet: MarkdownSnippet,
): void {
  if (previousSnippet) {
    removeSnippetFromRuntimeMaps(cache, previousSnippet)
  }

  cache.snippetById.set(snippet.id, snippet)
  snippet.contents.forEach((content, contentIndex) => {
    cache.contentOwnerByContentId.set(content.id, {
      contentIndex,
      snippet,
    })
  })
}

function commitRuntimeCache(cache: MarkdownRuntimeCache): MarkdownRuntimeCache {
  // A new object identity signals watcher consumers that data changed,
  // while built maps and the lazily rebuilt search index are reused.
  runtimeRef.cache = { ...cache }
  return runtimeRef.cache
}

export function syncSnippetFileWithDisk(
  paths: Paths,
  changedFilePath: string,
): MarkdownRuntimeCache | null {
  const cache = runtimeRef.cache
  if (!cache || cache.paths.vaultPath !== paths.vaultPath) {
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
  const snippets = cache.snippets
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
      return cache
    }

    const removedSnippetId = state.snippets[snippetIndexInState].id
    state.snippets.splice(snippetIndexInState, 1)

    const snippetIndexInRuntime = snippets.findIndex(
      snippet => snippet.id === removedSnippetId,
    )
    if (snippetIndexInRuntime !== -1) {
      const [removedSnippet] = snippets.splice(snippetIndexInRuntime, 1)
      removeSnippetFromRuntimeMaps(cache, removedSnippet)
    }

    saveState(paths, state)
    return commitRuntimeCache(cache)
  }

  let snippetIndexItem
    = snippetIndexInState !== -1 ? state.snippets[snippetIndexInState] : null

  if (!snippetIndexItem) {
    const frontmatterId = readFrontmatterIdFromSnippetFile(snippetAbsolutePath)

    // Неизвестный файл, содержимое которого сейчас недоступно (облачный
    // плейсхолдер или сбой чтения): регистрировать его нельзя, иначе id
    // был бы отчеканен вслепую и разошёлся бы с frontmatter-id после
    // докачки. Файл появится в индексе после фоновой докачки.
    if (frontmatterId === 'unreadable') {
      enqueueCloudDownload(snippetAbsolutePath)
      return cache
    }

    let snippetId = frontmatterId

    // Внешнее перемещение (mv A.md → B.md) может прислать add нового пути
    // раньше unlink старого: если frontmatter-id принадлежит записи, файла
    // которой уже нет на диске, это тот же сниппет — перенацеливаем запись,
    // сохраняя id, вместо аллокации нового.
    if (snippetId) {
      const ownerEntry = state.snippets.find(item => item.id === snippetId)

      if (
        ownerEntry
        && !fs.pathExistsSync(path.join(paths.vaultPath, ownerEntry.filePath))
      ) {
        ownerEntry.filePath = normalizedFilePath
        snippetIndexItem = ownerEntry
      }
    }

    if (!snippetIndexItem) {
      const existingSnippetIds = new Set<number>(
        state.snippets.map(item => item.id),
      )

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
  let previousSnippet: MarkdownSnippet | null = null
  if (snippetIndexInRuntime === -1) {
    snippets.push(syncedSnippet)
  }
  else {
    previousSnippet = snippets[snippetIndexInRuntime]
    snippets[snippetIndexInRuntime] = syncedSnippet
  }

  upsertSnippetInRuntimeMaps(cache, previousSnippet, syncedSnippet)
  syncCounters(state, snippets)

  // saveState marks the runtime search index dirty, so it is rebuilt
  // lazily on the next search instead of eagerly on every file change.
  saveState(paths, state)

  return commitRuntimeCache(cache)
}
