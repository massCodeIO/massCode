import type {
  ImportApplySummary,
  NoteImportCandidate,
  NoteImportParseResult,
} from '../common/types'
import { useNotesStorage } from '../../storage'
import {
  normalizeImportEntryName,
  normalizeImportTag,
} from '../snippets/normalizers'

function findFolderId(
  folders: ReturnType<
    ReturnType<typeof useNotesStorage>['folders']['getFolders']
  >,
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
  folders: ReturnType<
    ReturnType<typeof useNotesStorage>['folders']['getFolders']
  >,
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

function getUniqueNoteName(
  notes: ReturnType<ReturnType<typeof useNotesStorage>['notes']['getNotes']>,
  name: string,
): string {
  const names = new Set(notes.map(note => note.name.toLowerCase()))

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

function createImportRunFolder(parentId: number | null): {
  id: number
  name: string
} {
  const storage = useNotesStorage()
  const folders = storage.folders.getFolders()
  const name = getUniqueFolderName(folders, parentId, 'Obsidian')

  return {
    id: storage.folders.createFolder({ name, parentId }).id,
    name,
  }
}

function ensureFolderPath(
  rootFolderId: number,
  folderPath: string[] | undefined,
): { created: number, folderId: number } {
  const storage = useNotesStorage()
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
  const storage = useNotesStorage()
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

function createNote(
  candidate: NoteImportCandidate,
  folderId: number,
): { name: string, tagCount: number } {
  const storage = useNotesStorage()
  const name = getUniqueNoteName(
    storage.notes.getNotes({ folderId, isDeleted: 0 }),
    normalizeImportEntryName(candidate.name, 'Untitled note'),
  )
  const { id } = storage.notes.createNote({ folderId, name })

  storage.notes.updateNoteContent(id, candidate.content)

  const { created, tagIds } = getOrCreateTagIds(candidate.tags)
  tagIds.forEach((tagId) => {
    storage.notes.addTagToNote(id, tagId)
  })

  return { name, tagCount: created }
}

export function applyNotesImportResult(
  result: NoteImportParseResult,
): ImportApplySummary {
  const runFolder = createImportRunFolder(null)
  const createdNoteNames: string[] = []
  let folders = 1
  let tags = 0

  result.notes.forEach((candidate) => {
    const targetFolder = ensureFolderPath(runFolder.id, candidate.folderPath)
    folders += targetFolder.created

    const note = createNote(candidate, targetFolder.folderId)
    createdNoteNames.push(note.name)
    tags += note.tagCount
  })

  return {
    createdRootFolderName: runFolder.name,
    createdSnippetNames: [],
    folders,
    notes: createdNoteNames.length,
    snippets: 0,
    source: 'obsidian',
    tags,
    warnings: result.warnings,
  }
}
