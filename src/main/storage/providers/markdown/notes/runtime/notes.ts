import type {
  MarkdownNote,
  NotesFrontmatter,
  NotesIndexItem,
  NotesPaths,
  NotesState,
  PersistNoteOptions,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { splitFrontmatter } from '../../runtime/parser'
import { validateEntryName } from '../../runtime/validation'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  NOTES_INBOX_RELATIVE_PATH,
  NOTES_TRASH_RELATIVE_PATH,
  notesRuntimeRef,
  TRASH_DIR_NAME,
} from './constants'
import { buildNotesFolderPathMap, buildPathToNotesFolderIdMap } from './paths'

function toPosixPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

export function toNoteFileName(name: string): string {
  const normalized = validateEntryName(name, 'note')

  if (normalized.toLowerCase().endsWith('.md')) {
    return normalized
  }

  return `${normalized}.md`
}

export function serializeNote(note: MarkdownNote): string {
  const frontmatter: NotesFrontmatter = {
    createdAt: note.createdAt,
    description: note.description,
    folderId: note.folderId,
    id: note.id,
    isDeleted: note.isDeleted,
    isFavorites: note.isFavorites,
    name: note.name,
    tags: note.tags,
    updatedAt: note.updatedAt,
  }

  const frontmatterText = yaml
    .dump(frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  if (!note.content) {
    return `---\n${frontmatterText}\n---\n`
  }

  return `---\n${frontmatterText}\n---\n${note.content}`
}

export function readNoteFromFile(
  paths: NotesPaths,
  entry: NotesIndexItem,
  pathToFolderIdMap: Map<string, number>,
): MarkdownNote | null {
  const absolutePath = path.join(paths.notesRoot, entry.filePath)

  if (!fs.pathExistsSync(absolutePath)) {
    return null
  }

  const source = fs.readFileSync(absolutePath, 'utf8')
  const { body, frontmatter } = splitFrontmatter(source)
  const fm = frontmatter as NotesFrontmatter
  const now = Date.now()

  // Infer folderId from file path if not in frontmatter
  let folderId: number | null = fm.folderId ?? null
  if (folderId === null || folderId === undefined) {
    const dirPath = toPosixPath(path.posix.dirname(entry.filePath))
    if (dirPath && dirPath !== '.' && !dirPath.startsWith('.masscode')) {
      folderId = pathToFolderIdMap.get(dirPath) ?? null
    }
  }

  return {
    content: body,
    createdAt: normalizeNumber(fm.createdAt, now),
    description: fm.description ?? null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: normalizeFlag(fm.isDeleted),
    isFavorites: normalizeFlag(fm.isFavorites),
    name: fm.name || path.basename(entry.filePath, '.md'),
    tags: Array.isArray(fm.tags)
      ? fm.tags.filter(t => typeof t === 'number')
      : [],
    updatedAt: normalizeNumber(fm.updatedAt, now),
  }
}

export function writeNoteToFile(paths: NotesPaths, note: MarkdownNote): void {
  const absolutePath = path.join(paths.notesRoot, note.filePath)
  const nextContent = serializeNote(note)

  if (fs.pathExistsSync(absolutePath)) {
    const currentContent = fs.readFileSync(absolutePath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, nextContent, 'utf8')
}

export function loadNotes(
  paths: NotesPaths,
  state: NotesState,
): MarkdownNote[] {
  const pathToFolderIdMap = buildPathToNotesFolderIdMap(state)
  const notes: MarkdownNote[] = []

  for (const entry of state.notes) {
    const note = readNoteFromFile(paths, entry, pathToFolderIdMap)
    if (note) {
      notes.push(note)
    }
  }

  return notes
}

function getNoteTargetDirectory(state: NotesState, note: MarkdownNote): string {
  if (note.isDeleted) {
    return NOTES_TRASH_RELATIVE_PATH
  }

  if (note.folderId === null) {
    return NOTES_INBOX_RELATIVE_PATH
  }

  const folderPathMap = buildNotesFolderPathMap(state)
  const folderPath = folderPathMap.get(note.folderId)

  return folderPath || NOTES_INBOX_RELATIVE_PATH
}

export function buildNoteTargetPath(
  state: NotesState,
  note: MarkdownNote,
): string {
  const directory = getNoteTargetDirectory(state, note)
  const fileName = toNoteFileName(note.name)
  return path.posix.join(directory, fileName)
}

function getUniqueNotePath(
  paths: NotesPaths,
  state: NotesState,
  targetPath: string,
  currentFilePath: string | null,
): string {
  const targetAbsolutePath = path.join(paths.notesRoot, targetPath)

  if (!fs.pathExistsSync(targetAbsolutePath)) {
    return targetPath
  }

  if (currentFilePath) {
    const currentAbsolutePath = path.join(paths.notesRoot, currentFilePath)
    if (
      targetAbsolutePath.toLowerCase() === currentAbsolutePath.toLowerCase()
    ) {
      return targetPath
    }
  }

  const dir = path.posix.dirname(targetPath)
  const ext = path.posix.extname(targetPath)
  const baseName = path.posix.basename(targetPath, ext)

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidatePath = path.posix.join(dir, `${baseName} ${suffix}${ext}`)
    const candidateAbsolutePath = path.join(paths.notesRoot, candidatePath)

    if (!fs.pathExistsSync(candidateAbsolutePath)) {
      return candidatePath
    }
  }

  throw new Error('NAME_CONFLICT:Cannot generate unique note file name')
}

export function persistNote(
  paths: NotesPaths,
  state: NotesState,
  note: MarkdownNote,
  previousFilePath?: string,
  options?: PersistNoteOptions,
): void {
  const targetPath = buildNoteTargetPath(state, note)
  const currentFilePath = previousFilePath || note.filePath

  let resolvedPath: string
  if (options?.allowRenameOnConflict) {
    resolvedPath = getUniqueNotePath(paths, state, targetPath, currentFilePath)
  }
  else {
    resolvedPath = targetPath
  }

  // Move file if path changed
  if (currentFilePath && currentFilePath !== resolvedPath) {
    const currentAbsolutePath = path.join(paths.notesRoot, currentFilePath)
    if (fs.pathExistsSync(currentAbsolutePath)) {
      const targetAbsolutePath = path.join(paths.notesRoot, resolvedPath)
      fs.ensureDirSync(path.dirname(targetAbsolutePath))
      fs.moveSync(currentAbsolutePath, targetAbsolutePath, {
        overwrite: false,
      })
    }
  }

  note.filePath = resolvedPath

  // Update state index
  const indexEntry = state.notes.find(n => n.id === note.id)
  if (indexEntry) {
    indexEntry.filePath = resolvedPath
  }
  else {
    state.notes.push({ id: note.id, filePath: resolvedPath })
  }

  // Write content
  writeNoteToFile(paths, note)
}

export function findNoteById(
  notes: MarkdownNote[],
  id: number,
): MarkdownNote | undefined {
  const cache = notesRuntimeRef.cache
  if (cache) {
    if (cache.noteById.size !== cache.notes.length) {
      cache.noteById = new Map(cache.notes.map(n => [n.id, n]))
    }

    const noteFromCache = cache.noteById.get(id)
    if (noteFromCache) {
      return noteFromCache
    }
  }

  const note = notes.find(n => n.id === id)
  if (note && cache) {
    cache.noteById.set(id, note)
  }

  return note
}

export function listNoteMarkdownFiles(notesRoot: string): string[] {
  const files: string[] = []

  function walk(dir: string, relativeDir: string): void {
    if (!fs.pathExistsSync(dir)) {
      return
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryName = entry.name
      const isHiddenEntry = entryName.startsWith('.')

      const entryAbsolutePath = path.join(dir, entryName)
      const entryRelativePath = relativeDir
        ? `${relativeDir}/${entryName}`
        : entryName

      if (entry.isDirectory()) {
        // At root level, explicitly enter .masscode for inbox/trash
        if (relativeDir === '' && entryName === META_DIR_NAME) {
          const inboxPath = path.join(entryAbsolutePath, INBOX_DIR_NAME)
          const trashPath = path.join(entryAbsolutePath, TRASH_DIR_NAME)

          walk(inboxPath, `${entryRelativePath}/${INBOX_DIR_NAME}`)
          walk(trashPath, `${entryRelativePath}/${TRASH_DIR_NAME}`)
          continue
        }

        // Skip all other hidden directories
        if (isHiddenEntry) {
          continue
        }

        walk(entryAbsolutePath, entryRelativePath)
      }
      else if (!isHiddenEntry && entryName.toLowerCase().endsWith('.md')) {
        files.push(entryRelativePath)
      }
    }
  }

  walk(notesRoot, '')
  return files
}
