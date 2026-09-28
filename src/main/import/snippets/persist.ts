import type {
  ImportApplySummary,
  ImportSource,
  SnippetImportCandidate,
  SnippetImportParseResult,
} from '../common/types'
import { useStorage } from '../../storage'
import { normalizeImportEntryName, normalizeImportTag } from './normalizers'
import { getSnippetImportSourceName } from './source'

function findFolderId(
  folders: ReturnType<ReturnType<typeof useStorage>['folders']['getFolders']>,
  parentId: number | null,
  name: string,
): number | null {
  const folder = folders.find(
    item =>
      item.parentId === parentId
      && item.name.toLowerCase() === name.toLowerCase(),
  )

  return folder?.id ?? null
}

function getUniqueFolderName(
  folders: ReturnType<ReturnType<typeof useStorage>['folders']['getFolders']>,
  parentId: number | null,
  name: string,
): string {
  const siblingNames = new Set(
    folders
      .filter(folder => folder.parentId === parentId)
      .map(folder => folder.name.toLowerCase()),
  )

  if (!siblingNames.has(name.toLowerCase())) {
    return name
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = `${name} ${suffix}`
    if (!siblingNames.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  return `${name} ${Date.now()}`
}

function getUniqueSnippetName(
  snippets: ReturnType<
    ReturnType<typeof useStorage>['snippets']['getSnippets']
  >,
  name: string,
): string {
  const names = new Set(snippets.map(snippet => snippet.name.toLowerCase()))

  if (!names.has(name.toLowerCase())) {
    return name
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidate = `${name} ${suffix}`
    if (!names.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  return `${name} ${Date.now()}`
}

function createImportRunFolder(
  parentId: number | null,
  source: ImportSource,
): { id: number, name: string } {
  const storage = useStorage()
  const folders = storage.folders.getFolders()
  const name = getUniqueFolderName(
    folders,
    parentId,
    getSnippetImportSourceName(source),
  )

  return {
    id: storage.folders.createFolder({ name, parentId }).id,
    name,
  }
}

function ensureFolderPath(
  rootFolderId: number,
  folderPath: string[] | undefined,
): { created: number, folderId: number } {
  const storage = useStorage()
  let created = 0
  let parentId = rootFolderId

  for (const part of folderPath || []) {
    const name = normalizeImportEntryName(part, 'Imported')
    const folders = storage.folders.getFolders()
    const existingId = findFolderId(folders, parentId, name)

    if (existingId !== null) {
      parentId = existingId
      continue
    }

    parentId = storage.folders.createFolder({ name, parentId }).id
    created += 1
  }

  return { created, folderId: parentId }
}

function getOrCreateTagIds(tags: string[] | undefined): {
  created: number
  tagIds: number[]
} {
  const storage = useStorage()
  const tagIds: number[] = []
  let created = 0

  for (const rawTag of tags || []) {
    const name = normalizeImportTag(rawTag)
    if (!name) {
      continue
    }

    const existing = storage.tags
      .getTags()
      .find(tag => tag.name.toLowerCase() === name.toLowerCase())

    if (existing) {
      tagIds.push(existing.id)
      continue
    }

    const { id } = storage.tags.createTag(name)
    tagIds.push(id)
    created += 1
  }

  return { created, tagIds }
}

function createSnippet(
  candidate: SnippetImportCandidate,
  folderId: number,
): { name: string, tagCount: number } {
  const storage = useStorage()
  const name = getUniqueSnippetName(
    storage.snippets.getSnippets({ folderId, isDeleted: 0 }),
    normalizeImportEntryName(candidate.name, 'Untitled snippet'),
  )
  const { id } = storage.snippets.createSnippet({ folderId, name })

  if (candidate.description !== undefined) {
    storage.snippets.updateSnippet(id, {
      description: candidate.description ?? null,
    })
  }

  candidate.contents.forEach((content) => {
    storage.snippets.createSnippetContent(id, {
      label: normalizeImportEntryName(content.label, 'Fragment'),
      language: content.language || 'plain_text',
      value: content.value,
    })
  })

  const { created, tagIds } = getOrCreateTagIds(candidate.tags)
  tagIds.forEach((tagId) => {
    storage.snippets.addTagToSnippet(id, tagId)
  })

  return { name, tagCount: created }
}

export function applySnippetImportResult(
  source: ImportSource,
  result: SnippetImportParseResult,
): ImportApplySummary {
  if (!result.snippets.length) {
    return {
      createdRootFolderName: '',
      createdSnippetNames: [],
      folders: 0,
      notes: 0,
      snippets: 0,
      source,
      tags: 0,
      warnings: result.warnings,
    }
  }

  const runFolder = createImportRunFolder(null, source)
  const createdSnippetNames: string[] = []
  let folders = 1
  let tags = 0

  result.snippets.forEach((candidate) => {
    const targetFolder = ensureFolderPath(runFolder.id, candidate.folderPath)
    folders += targetFolder.created

    const snippet = createSnippet(candidate, targetFolder.folderId)
    createdSnippetNames.push(snippet.name)
    tags += snippet.tagCount
  })

  return {
    createdRootFolderName: runFolder.name,
    createdSnippetNames,
    folders,
    notes: 0,
    snippets: createdSnippetNames.length,
    source,
    tags,
    warnings: result.warnings,
  }
}
