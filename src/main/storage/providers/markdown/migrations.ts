import type { FolderRecord } from '../../contracts'
import path from 'node:path'
import fs from 'fs-extra'
import { useDB } from '../../../db'
import {
  assertNotReservedRootFolderName,
  buildFolderPathMap,
  buildSnippetTargetPath,
  createDefaultState,
  depthOfRelativePath,
  ensureStateFile,
  findFolderById,
  getPaths,
  getVaultPath,
  INVALID_NAME_CHARS_RE,
  loadSnippets,
  type MarkdownSnippet,
  type MarkdownState,
  type MarkdownTagState,
  META_DIR_NAME,
  type Paths,
  saveState,
  setRuntimeCache,
  type SqliteSnippetContentRow,
  type SqliteSnippetRow,
  type SqliteSnippetTagRow,
  syncCounters,
  syncFolderMetadataFiles,
  throwStorageError,
  validateEntryName,
  WINDOWS_RESERVED_NAME_RE,
  writeSnippetToFile,
} from './runtime'

function clearVaultForMigration(paths: Paths): void {
  fs.ensureDirSync(paths.vaultPath)

  const entries = fs.readdirSync(paths.vaultPath)
  for (const entry of entries) {
    if (entry === META_DIR_NAME) {
      continue
    }

    fs.removeSync(path.join(paths.vaultPath, entry))
  }

  fs.ensureDirSync(paths.inboxDirPath)
  fs.ensureDirSync(paths.trashDirPath)
  fs.emptyDirSync(paths.inboxDirPath)
  fs.emptyDirSync(paths.trashDirPath)
}

const RESERVED_ROOT_FOLDER_NAMES = new Set(['.masscode', 'inbox', 'trash'])

function removeControlChars(value: string): string {
  return [...value].filter(char => char.charCodeAt(0) > 0x1F).join('')
}

function sanitizeEntryNameForMigration(
  name: string | null | undefined,
  kind: 'folder' | 'snippet',
): string {
  const fallback = kind === 'folder' ? 'Untitled folder' : 'Untitled snippet'
  let candidate = typeof name === 'string' ? name.trim() : ''

  candidate = removeControlChars(candidate)
  candidate = candidate.replace(INVALID_NAME_CHARS_RE, ' ')
  candidate = candidate.replace(/\s+/g, ' ').trim()
  candidate = candidate.replace(/[. ]+$/g, '').trim()

  if (!candidate || candidate === '.' || candidate === '..') {
    candidate = fallback
  }

  if (WINDOWS_RESERVED_NAME_RE.test(candidate)) {
    candidate = `${candidate} 1`
  }

  try {
    return validateEntryName(candidate, kind)
  }
  catch {
    return fallback
  }
}

function getUniqueFolderName(
  baseName: string,
  parentId: number | null,
  occupiedSiblingNames: Set<string>,
): string {
  for (let suffix = 0; suffix <= 10_000; suffix += 1) {
    const candidate = suffix === 0 ? baseName : `${baseName} ${suffix}`
    const lowerCaseCandidate = candidate.toLowerCase()

    if (
      parentId === null
      && RESERVED_ROOT_FOLDER_NAMES.has(lowerCaseCandidate)
    ) {
      continue
    }

    try {
      const validated = validateEntryName(candidate, 'folder')
      assertNotReservedRootFolderName(parentId, validated)
      const key = validated.toLowerCase()

      if (occupiedSiblingNames.has(key)) {
        continue
      }

      occupiedSiblingNames.add(key)
      return validated
    }
    catch {
      continue
    }
  }

  throwStorageError(
    'NAME_CONFLICT',
    `Cannot generate unique folder name for "${baseName}"`,
  )
}

function normalizeFoldersForMigration(folders: FolderRecord[]): FolderRecord[] {
  const knownFolderIds = new Set<number>(folders.map(folder => folder.id))
  const occupiedNamesByParent = new Map<string, Set<string>>()

  return folders.map((folder) => {
    const parentId
      = folder.parentId !== null
        && folder.parentId !== folder.id
        && knownFolderIds.has(folder.parentId)
        ? folder.parentId
        : null

    const parentKey = String(parentId ?? 'root')
    const occupiedSiblingNames
      = occupiedNamesByParent.get(parentKey) || new Set<string>()
    const normalizedBaseName = sanitizeEntryNameForMigration(
      folder.name,
      'folder',
    )
    const normalizedName = getUniqueFolderName(
      normalizedBaseName,
      parentId,
      occupiedSiblingNames,
    )

    occupiedNamesByParent.set(parentKey, occupiedSiblingNames)

    return {
      ...folder,
      name: normalizedName,
      parentId,
    }
  })
}

function appendSnippetNameSuffix(name: string, suffix: number): string {
  if (!name.toLowerCase().endsWith('.md')) {
    return `${name} ${suffix}`
  }

  const nameWithoutExtension
    = name.slice(0, -3).trimEnd() || 'Untitled snippet'
  return `${nameWithoutExtension} ${suffix}.md`
}

function resolveUniqueSnippetPathForMigration(
  state: MarkdownState,
  snippet: MarkdownSnippet,
  occupiedSnippetPaths: Set<string>,
): string {
  const normalizedBaseName = sanitizeEntryNameForMigration(
    snippet.name,
    'snippet',
  )

  for (let suffix = 0; suffix <= 10_000; suffix += 1) {
    const candidateName
      = suffix === 0
        ? normalizedBaseName
        : appendSnippetNameSuffix(normalizedBaseName, suffix)

    try {
      snippet.name = validateEntryName(candidateName, 'snippet')
    }
    catch {
      continue
    }

    const candidatePath = buildSnippetTargetPath(state, snippet)
    const candidatePathKey = candidatePath.toLowerCase()

    if (occupiedSnippetPaths.has(candidatePathKey)) {
      continue
    }

    occupiedSnippetPaths.add(candidatePathKey)
    return candidatePath
  }

  throwStorageError(
    'NAME_CONFLICT',
    `Cannot generate unique snippet name for "${snippet.name}"`,
  )
}

export function migrateSqliteToMarkdownStorage(): {
  folders: number
  snippets: number
  tags: number
} {
  const db = useDB()
  const paths = getPaths(getVaultPath())
  ensureStateFile(paths)

  const folders = db
    .prepare(
      `
        SELECT
          id,
          name,
          createdAt,
          updatedAt,
          icon,
          parentId,
          isOpen,
          defaultLanguage,
          orderIndex
        FROM folders
      `,
    )
    .all() as FolderRecord[]

  const tags = db
    .prepare(
      `
        SELECT id, name, createdAt, updatedAt
        FROM tags
      `,
    )
    .all() as MarkdownTagState[]

  const snippets = db
    .prepare(
      `
        SELECT
          id,
          name,
          description,
          folderId,
          isDeleted,
          isFavorites,
          createdAt,
          updatedAt
        FROM snippets
      `,
    )
    .all() as SqliteSnippetRow[]

  const snippetContents = db
    .prepare(
      `
        SELECT
          id,
          snippetId,
          label,
          value,
          language
        FROM snippet_contents
        ORDER BY id ASC
      `,
    )
    .all() as SqliteSnippetContentRow[]

  const snippetTags = db
    .prepare(
      `
        SELECT snippetId, tagId
        FROM snippet_tags
      `,
    )
    .all() as SqliteSnippetTagRow[]

  const contentBySnippet = new Map<number, SqliteSnippetContentRow[]>()
  snippetContents.forEach((content) => {
    const collection = contentBySnippet.get(content.snippetId) || []
    collection.push(content)
    contentBySnippet.set(content.snippetId, collection)
  })

  const tagsBySnippet = new Map<number, number[]>()
  snippetTags.forEach((relation) => {
    const collection = tagsBySnippet.get(relation.snippetId) || []
    collection.push(relation.tagId)
    tagsBySnippet.set(relation.snippetId, collection)
  })

  clearVaultForMigration(paths)

  const state = createDefaultState()
  state.folders = normalizeFoldersForMigration(folders)
  state.tags = tags

  const folderPathMap = buildFolderPathMap(state)
  const orderedFolderPaths = [...folderPathMap.values()].sort((a, b) => {
    const depthA = depthOfRelativePath(a)
    const depthB = depthOfRelativePath(b)

    if (depthA !== depthB) {
      return depthA - depthB
    }

    return a.localeCompare(b)
  })

  orderedFolderPaths.forEach((folderPath) => {
    fs.ensureDirSync(path.join(paths.vaultPath, folderPath))
  })

  syncFolderMetadataFiles(paths, state)

  const occupiedSnippetPaths = new Set<string>()

  snippets.forEach((snippet) => {
    const folderId
      = snippet.folderId !== null && findFolderById(state, snippet.folderId)
        ? snippet.folderId
        : null

    const markdownSnippet: MarkdownSnippet = {
      contents: (contentBySnippet.get(snippet.id) || []).map(
        (content, index) => ({
          id: content.id,
          label: content.label || `Fragment ${index + 1}`,
          language: content.language || 'plain_text',
          value: content.value,
        }),
      ),
      createdAt: snippet.createdAt,
      description: snippet.description,
      filePath: '',
      folderId,
      id: snippet.id,
      isDeleted: snippet.isDeleted,
      isFavorites: snippet.isFavorites,
      name: sanitizeEntryNameForMigration(snippet.name, 'snippet'),
      tags: tagsBySnippet.get(snippet.id) || [],
      updatedAt: snippet.updatedAt,
    }

    const filePath = resolveUniqueSnippetPathForMigration(
      state,
      markdownSnippet,
      occupiedSnippetPaths,
    )

    markdownSnippet.filePath = filePath
    writeSnippetToFile(paths, markdownSnippet)

    state.snippets.push({
      filePath,
      id: snippet.id,
    })
  })

  const runtimeSnippets = loadSnippets(paths, state)
  syncCounters(state, runtimeSnippets)
  saveState(paths, state, { immediate: true })
  setRuntimeCache(paths, state, runtimeSnippets)

  return {
    folders: state.folders.length,
    snippets: state.snippets.length,
    tags: state.tags.length,
  }
}
