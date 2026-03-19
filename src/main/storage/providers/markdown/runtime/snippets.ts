import type { SnippetRecord } from '../../../contracts'
import type {
  DirectoryEntriesCache,
  MarkdownSnippet,
  MarkdownSnippetIndexItem,
  MarkdownState,
  Paths,
  PersistSnippetOptions,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { runtimeRef } from './cache'
import {
  INBOX_DIR_NAME,
  INBOX_RELATIVE_PATH,
  LEGACY_INBOX_RELATIVE_PATH,
  LEGACY_TRASH_RELATIVE_PATH,
  META_DIR_NAME,
  SPACES_DIR_NAME,
  TRASH_DIR_NAME,
  TRASH_RELATIVE_PATH,
} from './constants'
import { normalizeNullableNumber, normalizeNumber } from './normalizers'
import {
  parseBodyFragments,
  serializeSnippet,
  splitFrontmatter,
} from './parser'
import {
  buildPathToFolderIdMap,
  findFolderById,
  getFolderPathById,
  normalizeDirectoryPath,
} from './paths'
import { listMarkdownFiles as listMarkdownFilesShared } from './shared/path'
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
  return listMarkdownFilesShared(
    rootPath,
    META_DIR_NAME,
    INBOX_DIR_NAME,
    TRASH_DIR_NAME,
    new Set([SPACES_DIR_NAME]),
  )
}

export function readFrontmatterIdFromSnippetFile(
  snippetPath: string,
): number | null {
  if (!fs.pathExistsSync(snippetPath)) {
    return null
  }

  const source = fs.readFileSync(snippetPath, 'utf8')
  const { frontmatter } = splitFrontmatter(source)
  const id = normalizeNumber(frontmatter.id)

  return id > 0 ? id : null
}

export function readSnippetFromFile(
  paths: Paths,
  entry: MarkdownSnippetIndexItem,
  pathToFolderIdMap: ReadonlyMap<string, number>,
): MarkdownSnippet | null {
  const snippetPath = path.join(paths.vaultPath, entry.filePath)

  if (!fs.pathExistsSync(snippetPath)) {
    return null
  }

  const source = fs.readFileSync(snippetPath, 'utf8')
  const { body, frontmatter, hasFrontmatter } = splitFrontmatter(source)
  const now = Date.now()
  const timestampFallbacks = getFileTimestampFallbacks(snippetPath, now)
  const fragments = parseBodyFragments(body)
  const metaContents = Array.isArray(frontmatter.contents)
    ? frontmatter.contents
    : []

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
    writeSnippetToFile(paths, snippet)
  }

  return snippet
}

export function loadSnippets(
  paths: Paths,
  state: MarkdownState,
): MarkdownSnippet[] {
  const pathToFolderIdMap = buildPathToFolderIdMap(state)

  return state.snippets
    .map(item => readSnippetFromFile(paths, item, pathToFolderIdMap))
    .filter((snippet): snippet is MarkdownSnippet => !!snippet)
}

export function writeSnippetToFile(
  paths: Paths,
  snippet: MarkdownSnippet,
): void {
  const snippetPath = path.join(paths.vaultPath, snippet.filePath)
  const nextContent = serializeSnippet(snippet)

  fs.ensureDirSync(path.dirname(snippetPath))

  if (fs.pathExistsSync(snippetPath)) {
    const currentContent = fs.readFileSync(snippetPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.writeFileSync(snippetPath, nextContent, 'utf8')
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

function getCachedDirectoryEntries(
  directoryPath: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): string[] {
  if (!directoryEntriesCache) {
    return fs.readdirSync(directoryPath)
  }

  const cachedEntries = directoryEntriesCache.get(directoryPath)
  if (cachedEntries) {
    return cachedEntries
  }

  const entries = fs.readdirSync(directoryPath)
  directoryEntriesCache.set(directoryPath, [...entries])
  return entries
}

function removeDirectoryEntryFromCache(
  directoryPath: string,
  fileName: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  if (!directoryEntriesCache) {
    return
  }

  const entries = directoryEntriesCache.get(directoryPath)
  if (!entries) {
    return
  }

  const normalizedFileName = fileName.toLowerCase()
  const nextEntries = entries.filter(
    entry => entry.toLowerCase() !== normalizedFileName,
  )

  directoryEntriesCache.set(directoryPath, nextEntries)
}

function upsertDirectoryEntryInCache(
  directoryPath: string,
  fileName: string,
  directoryEntriesCache?: DirectoryEntriesCache,
): void {
  if (!directoryEntriesCache) {
    return
  }

  const entries
    = directoryEntriesCache.get(directoryPath) || fs.readdirSync(directoryPath)
  const normalizedFileName = fileName.toLowerCase()
  const nextEntries = entries.filter(
    entry => entry.toLowerCase() !== normalizedFileName,
  )

  nextEntries.push(fileName)
  directoryEntriesCache.set(directoryPath, nextEntries)
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

    removeDirectoryEntryFromCache(
      path.dirname(sourceAbsolutePath),
      path.basename(sourceAbsolutePath),
      directoryEntriesCache,
    )
  }

  snippet.filePath = targetPath
  writeSnippetToFile(paths, snippet)
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
