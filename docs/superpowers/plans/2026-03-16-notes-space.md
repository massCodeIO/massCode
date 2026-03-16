# Notes Space Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Notes Space in massCode — a 3-column layout (folders, notes list, markdown editor) with full CRUD, tags, favorites, trash, inbox, search, stored as .md files in `__spaces__/notes/` within the markdown vault.

**Architecture:** Notes Space mirrors the Code Space pattern: storage runtime + CRUD storages → REST API (Elysia) → generated typed client → Vue composables → UI components. Storage is markdown-vault-only. Each note is a .md file with YAML frontmatter. Folders are real directories with `.meta.yaml`. State index in `__spaces__/notes/.masscode/state.json`.

**Tech Stack:** Vue 3 (Composition API), Elysia.js, fs-extra, js-yaml, CodeMirror 6, TailwindCSS v4, lucide-vue-next

**Spec:** `docs/superpowers/specs/2026-03-16-notes-space-design.md`

---

## Chunk 1: Storage Runtime Foundation

### Task 1: Notes types and interfaces

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/types.ts`
- Modify: `src/main/storage/contracts.ts`

- [ ] **Step 1: Create notes runtime types**

Create `src/main/storage/providers/markdown/notes/runtime/types.ts`:

```typescript
import type { Paths as SnippetPaths } from '../../runtime/types'

export interface NotesPaths {
  inboxDirPath: string
  metaDirPath: string
  notesRoot: string
  statePath: string
  trashDirPath: string
}

export interface NotesTagState {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

export interface NotesIndexItem {
  filePath: string
  id: number
}

export interface NotesFolderRecord {
  id: number
  name: string
  parentId: number | null
  icon: string | null
  isOpen: number
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export interface NotesFolderTreeRecord extends NotesFolderRecord {
  children: NotesFolderTreeRecord[]
}

export interface NotesFolderMetadataFile {
  createdAt?: number
  icon?: string | null
  id?: number
  name?: string
  orderIndex?: number
  updatedAt?: number
}

export interface NotesFolderDiskEntry {
  metadata: NotesFolderMetadataFile
  path: string
}

export interface NotesFolderUIState {
  isOpen: number
}

export interface NotesStateFile {
  counters?: {
    folderId?: number
    noteId?: number
    tagId?: number
  }
  folderUi?: Record<string, { isOpen?: number }>
  folders?: NotesFolderRecord[]
  notes?: NotesIndexItem[]
  tags?: NotesTagState[]
  version?: number
}

export interface NotesState {
  counters: {
    folderId: number
    noteId: number
    tagId: number
  }
  folderUi: Record<string, NotesFolderUIState>
  folders: NotesFolderRecord[]
  notes: NotesIndexItem[]
  tags: NotesTagState[]
  version: number
}

export interface NotesFrontmatter {
  createdAt?: number
  description?: string | null
  folderId?: number | null
  id?: number
  isDeleted?: number
  isFavorites?: number
  name?: string
  tags?: number[]
  updatedAt?: number
}

export interface MarkdownNote {
  content: string
  createdAt: number
  description: string | null
  filePath: string
  folderId: number | null
  id: number
  isDeleted: number
  isFavorites: number
  name: string
  tags: number[]
  updatedAt: number
}

export interface NotesRuntimeCache {
  folderById: Map<number, NotesFolderRecord>
  noteById: Map<number, MarkdownNote>
  notes: MarkdownNote[]
  paths: NotesPaths
  searchIndexDirty: boolean
  searchNoteTextById: Map<number, string>
  searchQueryCache: Map<string, number[]>
  searchTokenToNoteIds: Map<string, Set<number>>
  searchTokensByNoteId: Map<number, string[]>
  state: NotesState
}

export interface PersistNoteOptions {
  allowRenameOnConflict?: boolean
  directoryEntriesCache?: Map<string, string[]>
}
```

- [ ] **Step 2: Add notes contracts to contracts.ts**

Add to `src/main/storage/contracts.ts` after the existing `StorageProvider` interface:

```typescript
// --- Notes Space Contracts ---

export interface NoteRecord {
  id: number
  name: string
  description: string | null
  content: string
  tags: NoteTagRecord[]
  folder: NoteFolderInfo | null
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

export interface NoteTagRecord {
  id: number
  name: string
}

export interface NoteFolderInfo {
  id: number
  name: string
}

export interface NotesQueryInput {
  search?: string
  order?: 'ASC' | 'DESC'
  folderId?: number
  tagId?: number
  isFavorites?: number
  isDeleted?: number
  isInbox?: number
}

export interface NoteCreateInput {
  name: string
  folderId?: number | null
}

export interface NoteUpdateInput {
  name?: string
  folderId?: number | null
  description?: string | null
  isDeleted?: number
  isFavorites?: number
}

export interface NoteUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface NoteTagRelationResult {
  notFound: false
  noteFound: boolean
  tagFound: boolean
}

export interface NoteTagDeleteRelationResult {
  notFound: false
  noteFound: boolean
  tagFound: boolean
  relationFound: boolean
}

export interface NotesCount {
  total: number
  trash: number
}

export interface NoteFolderCreateInput {
  name: string
  parentId?: number | null
}

export interface NoteFolderUpdateInput {
  name?: string
  icon?: string | null
  parentId?: number | null
  isOpen?: number
  orderIndex?: number
}

export interface NoteFolderUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface NotesStorageProvider {
  folders: NotesFoldersStorage
  notes: NotesStorage
  tags: NoteTagsStorage
}

export interface NotesFoldersStorage {
  createFolder: (input: NoteFolderCreateInput) => { id: number }
  deleteFolder: (id: number) => { deleted: boolean }
  getFolders: () => NotesFolderRecord[]
  getFoldersTree: () => NotesFolderTreeRecord[]
  updateFolder: (id: number, input: NoteFolderUpdateInput) => NoteFolderUpdateResult
}

export interface NotesStorage {
  addTagToNote: (noteId: number, tagId: number) => NoteTagRelationResult
  createNote: (input: NoteCreateInput) => { id: number }
  deleteNote: (id: number) => { deleted: boolean }
  deleteTagFromNote: (noteId: number, tagId: number) => NoteTagDeleteRelationResult
  emptyTrash: () => { deletedCount: number }
  getNotes: (query: NotesQueryInput) => NoteRecord[]
  getNotesCounts: () => NotesCount
  updateNote: (id: number, input: NoteUpdateInput) => NoteUpdateResult
  updateNoteContent: (id: number, content: string) => NoteUpdateResult
}

export interface NoteTagsStorage {
  createTag: (name: string) => { id: number }
  deleteTag: (id: number) => { deleted: boolean }
  getTags: () => NoteTagRecord[]
  updateTag: (id: number, name: string) => { notFound: boolean }
}
```

Import the folder/tree record types from the notes runtime:

```typescript
import type { NotesFolderRecord, NotesFolderTreeRecord } from './providers/markdown/notes/runtime/types'
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm lint src/main/storage/contracts.ts src/main/storage/providers/markdown/notes/runtime/types.ts`

- [ ] **Step 4: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/types.ts src/main/storage/contracts.ts
git commit -m "feat(notes): add notes storage types and contracts"
```

---

### Task 2: Notes constants and paths

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/constants.ts`

- [ ] **Step 1: Create notes constants**

Create `src/main/storage/providers/markdown/notes/runtime/constants.ts`:

```typescript
import type { NotesRuntimeCache } from './types'
import path from 'node:path'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  SPACES_DIR_NAME,
  TRASH_DIR_NAME,
} from '../../runtime/constants'

export { INBOX_DIR_NAME, META_DIR_NAME, TRASH_DIR_NAME }

export const NOTES_SPACE_ID = 'notes'

export const NOTES_INBOX_RELATIVE_PATH = `${META_DIR_NAME}/${INBOX_DIR_NAME}`
export const NOTES_TRASH_RELATIVE_PATH = `${META_DIR_NAME}/${TRASH_DIR_NAME}`

export const NOTES_RESERVED_ROOT_NAMES = new Set([
  INBOX_DIR_NAME,
  TRASH_DIR_NAME,
])

export const notesRuntimeRef: { cache: NotesRuntimeCache | null } = {
  cache: null,
}

export function getNotesPaths(vaultPath: string) {
  const notesRoot = path.join(vaultPath, SPACES_DIR_NAME, NOTES_SPACE_ID)
  const metaDirPath = path.join(notesRoot, META_DIR_NAME)

  return {
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    metaDirPath,
    notesRoot,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
  }
}

export function peekNotesRuntimeCache(): NotesRuntimeCache | null {
  return notesRuntimeRef.cache
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/constants.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/constants.ts
git commit -m "feat(notes): add notes constants and getNotesPaths"
```

---

### Task 3: Notes state persistence

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/state.ts`

- [ ] **Step 1: Create notes state module**

Create `src/main/storage/providers/markdown/notes/runtime/state.ts`:

```typescript
import type {
  NotesFolderUIState,
  NotesPaths,
  NotesState,
  NotesStateFile,
} from './types'
import fs from 'fs-extra'
import {
  pendingStateWriteByPath,
  STATE_WRITE_DEBOUNCE_MS,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from '../../runtime/constants'
import { normalizeFlag, normalizeFolderUiState } from '../../runtime/normalizers'

export function createDefaultNotesState(): NotesState {
  return {
    counters: {
      folderId: 0,
      noteId: 0,
      tagId: 0,
    },
    folderUi: {},
    folders: [],
    notes: [],
    tags: [],
    version: 1,
  }
}

export function syncNotesFolderUiWithFolders(state: NotesState): void {
  const nextFolderUi: Record<string, NotesFolderUIState> = {}

  state.folders.forEach((folder) => {
    const isOpen = normalizeFlag(folder.isOpen)
    folder.isOpen = isOpen
    nextFolderUi[String(folder.id)] = { isOpen }
  })

  state.folderUi = nextFolderUi
}

function getPersistedStateContent(statePath: string): string {
  const cachedStateContent = stateContentCacheByPath.get(statePath)
  if (cachedStateContent !== undefined) {
    return cachedStateContent
  }

  const persistedStateContent = fs.pathExistsSync(statePath)
    ? fs.readFileSync(statePath, 'utf8')
    : ''

  stateContentCacheByPath.set(statePath, persistedStateContent)
  return persistedStateContent
}

function flushPendingNoteStateWriteByPath(statePath: string): void {
  const pendingStateContent = pendingStateWriteByPath.get(statePath)
  if (pendingStateContent === undefined) {
    return
  }

  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
    stateFlushTimerByPath.delete(statePath)
  }

  const persistedStateContent = getPersistedStateContent(statePath)
  if (persistedStateContent !== pendingStateContent) {
    fs.ensureDirSync(require('node:path').dirname(statePath))
    fs.writeFileSync(statePath, pendingStateContent, 'utf8')
  }

  stateContentCacheByPath.set(statePath, pendingStateContent)
  pendingStateWriteByPath.delete(statePath)
}

function scheduleNoteStateFlush(statePath: string): void {
  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
  }

  const nextFlushTimer = setTimeout(
    () => flushPendingNoteStateWriteByPath(statePath),
    STATE_WRITE_DEBOUNCE_MS,
  )
  stateFlushTimerByPath.set(statePath, nextFlushTimer)
}

export function ensureNotesStateFile(paths: NotesPaths): void {
  fs.ensureDirSync(paths.notesRoot)
  fs.ensureDirSync(paths.metaDirPath)
  fs.ensureDirSync(paths.inboxDirPath)
  fs.ensureDirSync(paths.trashDirPath)

  if (!fs.pathExistsSync(paths.statePath)) {
    const defaultStateContent = `${JSON.stringify(createDefaultNotesState(), null, 2)}\n`
    fs.writeFileSync(paths.statePath, defaultStateContent, 'utf8')
    stateContentCacheByPath.set(paths.statePath, defaultStateContent)
  }
}

export function loadNotesState(paths: NotesPaths): NotesState {
  ensureNotesStateFile(paths)

  const defaultState = createDefaultNotesState()
  const rawState = fs.readJSONSync(paths.statePath) as NotesStateFile
  const legacyFolders = Array.isArray(rawState.folders) ? rawState.folders : []
  const folderUi = normalizeFolderUiState(rawState.folderUi)

  if (Object.keys(folderUi).length === 0 && legacyFolders.length) {
    legacyFolders.forEach((folder) => {
      folderUi[String(folder.id)] = {
        isOpen: normalizeFlag(folder.isOpen),
      }
    })
  }

  return {
    counters: {
      ...defaultState.counters,
      ...rawState.counters,
    },
    folderUi,
    folders: legacyFolders,
    notes: Array.isArray(rawState.notes) ? rawState.notes : [],
    tags: Array.isArray(rawState.tags) ? rawState.tags : [],
    version: typeof rawState.version === 'number' ? rawState.version : defaultState.version,
  }
}

export function saveNotesState(
  paths: NotesPaths,
  state: NotesState,
  options?: { immediate?: boolean },
): void {
  syncNotesFolderUiWithFolders(state)

  const nextVersion = Math.max(state.version, 1)
  state.version = nextVersion

  const persistedState: NotesStateFile = {
    counters: state.counters,
    folderUi: state.folderUi,
    notes: state.notes,
    tags: state.tags,
    version: nextVersion,
  }

  const nextContent = `${JSON.stringify(persistedState, null, 2)}\n`
  const statePath = paths.statePath
  const pendingContent = pendingStateWriteByPath.get(statePath)
  if (pendingContent === nextContent) {
    return
  }

  const persistedContent = getPersistedStateContent(statePath)
  if (persistedContent === nextContent && pendingContent === undefined) {
    return
  }

  pendingStateWriteByPath.set(statePath, nextContent)

  if (options?.immediate) {
    flushPendingNoteStateWriteByPath(statePath)
    return
  }

  scheduleNoteStateFlush(statePath)
}

export function flushPendingNotesStateWrite(paths: NotesPaths): void {
  flushPendingNoteStateWriteByPath(paths.statePath)
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/state.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/state.ts
git commit -m "feat(notes): add notes state persistence with shared debounce"
```

---

### Task 4: Notes paths utilities

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/paths.ts`

- [ ] **Step 1: Create notes paths module**

Create `src/main/storage/providers/markdown/notes/runtime/paths.ts`. This is analogous to the snippet `paths.ts` but operates on `NotesState` / `NotesFolderRecord`:

```typescript
import type { NotesFolderRecord, NotesState } from './types'
import path from 'node:path'
import { notesRuntimeRef } from './constants'

export function buildNotesFolderPathMap(state: NotesState): Map<number, string> {
  const folderById = new Map<number, NotesFolderRecord>()
  state.folders.forEach(folder => folderById.set(folder.id, folder))

  const resolvedMap = new Map<number, string>()
  const visiting = new Set<number>()

  const resolveFolderPath = (folderId: number): string => {
    const existingPath = resolvedMap.get(folderId)
    if (existingPath !== undefined) {
      return existingPath
    }

    const folder = folderById.get(folderId)
    if (!folder) {
      return ''
    }

    if (visiting.has(folderId)) {
      return folder.name
    }

    visiting.add(folderId)

    const parentPath = folder.parentId !== null ? resolveFolderPath(folder.parentId) : ''
    const currentPath = parentPath
      ? path.posix.join(parentPath, folder.name)
      : folder.name

    resolvedMap.set(folderId, currentPath)
    visiting.delete(folderId)

    return currentPath
  }

  state.folders.forEach(folder => resolveFolderPath(folder.id))

  return resolvedMap
}

export function buildPathToNotesFolderIdMap(state: NotesState): Map<string, number> {
  const folderPathMap = buildNotesFolderPathMap(state)
  const pathMap = new Map<string, number>()

  folderPathMap.forEach((folderPath, folderId) => {
    pathMap.set(folderPath, folderId)
  })

  return pathMap
}

export function findNotesFolderById(
  state: NotesState,
  folderId: number,
): NotesFolderRecord | undefined {
  const cache = notesRuntimeRef.cache
  const runtimeCache = cache?.state === state ? cache : null

  if (runtimeCache) {
    if (runtimeCache.folderById.size !== state.folders.length) {
      runtimeCache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )
    }

    const folderFromIndex = runtimeCache.folderById.get(folderId)
    if (folderFromIndex) {
      return folderFromIndex
    }
  }

  const folder = state.folders.find(item => item.id === folderId)
  if (folder && runtimeCache) {
    runtimeCache.folderById.set(folderId, folder)
  }

  return folder
}

export function getNotesFolderPathById(
  state: NotesState,
  folderId: number,
): string | null {
  const folderPathMap = buildNotesFolderPathMap(state)
  return folderPathMap.get(folderId) || null
}

export function getNotesFolderSiblings(
  state: NotesState,
  parentId: number | null,
  excludeId?: number,
): NotesFolderRecord[] {
  return state.folders.filter((folder) => {
    if (folder.parentId !== parentId) {
      return false
    }

    if (excludeId !== undefined && folder.id === excludeId) {
      return false
    }

    return true
  })
}

export function getNextNotesFolderOrder(
  state: NotesState,
  parentId: number | null,
): number {
  return (
    state.folders
      .filter(folder => folder.parentId === parentId)
      .reduce((maxOrder, folder) => Math.max(maxOrder, folder.orderIndex), -1)
      + 1
  )
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/paths.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/paths.ts
git commit -m "feat(notes): add notes folder path utilities"
```

---

### Task 5: Notes file I/O (read, write, serialize, persist)

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/notes.ts`

- [ ] **Step 1: Create notes file I/O module**

Create `src/main/storage/providers/markdown/notes/runtime/notes.ts`. This is analogous to `runtime/snippets.ts` but simplified — no fragments, body = content:

```typescript
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
import { splitFrontmatter } from '../../runtime/parser'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { validateEntryName } from '../../runtime/validation'
import {
  NOTES_INBOX_RELATIVE_PATH,
  NOTES_TRASH_RELATIVE_PATH,
  notesRuntimeRef,
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

  return `---\n${frontmatterText}\n---\n\n${note.content}\n`
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
    content: body.trim(),
    createdAt: normalizeNumber(fm.createdAt, now),
    description: fm.description ?? null,
    filePath: entry.filePath,
    folderId,
    id: entry.id,
    isDeleted: normalizeFlag(fm.isDeleted),
    isFavorites: normalizeFlag(fm.isFavorites),
    name: fm.name || path.basename(entry.filePath, '.md'),
    tags: Array.isArray(fm.tags) ? fm.tags.filter(t => typeof t === 'number') : [],
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

function getNoteTargetDirectory(
  state: NotesState,
  note: MarkdownNote,
): string {
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
    if (targetAbsolutePath.toLowerCase() === currentAbsolutePath.toLowerCase()) {
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
      fs.moveSync(currentAbsolutePath, targetAbsolutePath, { overwrite: false })
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

      // Skip hidden files/directories
      if (entryName.startsWith('.')) {
        continue
      }

      const entryAbsolutePath = path.join(dir, entryName)
      const entryRelativePath = relativeDir
        ? `${relativeDir}/${entryName}`
        : entryName

      if (entry.isDirectory()) {
        walk(entryAbsolutePath, entryRelativePath)
      }
      else if (entryName.toLowerCase().endsWith('.md')) {
        files.push(entryRelativePath)
      }
    }
  }

  walk(notesRoot, '')
  return files
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/notes.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/notes.ts
git commit -m "feat(notes): add note file I/O, serialization, and persistence"
```

---

### Task 6: Notes folder metadata read/write

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/parser.ts`

- [ ] **Step 1: Create notes parser module**

Create `src/main/storage/providers/markdown/notes/runtime/parser.ts`:

```typescript
import type { NotesFolderMetadataFile, NotesFolderRecord, NotesPaths } from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { META_FILE_NAME } from './constants'
import { readYamlObjectFile, writeYamlObjectFile } from '../../runtime/parser'

export function readNotesFolderMetadata(
  paths: NotesPaths,
  folderRelativePath: string,
): NotesFolderMetadataFile {
  const folderAbsPath = path.join(paths.notesRoot, folderRelativePath)
  const metaPath = path.join(folderAbsPath, META_FILE_NAME)

  const metaData = readYamlObjectFile<NotesFolderMetadataFile>(metaPath)
  if (metaData) {
    return metaData
  }

  return {}
}

export function serializeNotesFolderMetadata(
  folder: NotesFolderRecord,
): Record<string, unknown> {
  return {
    id: folder.id,
    createdAt: folder.createdAt,
    icon: folder.icon,
    name: folder.name,
    orderIndex: folder.orderIndex,
    updatedAt: folder.updatedAt,
  }
}

export function writeNotesFolderMetadataFile(
  paths: NotesPaths,
  folderRelativePath: string,
  folder: NotesFolderRecord,
): void {
  const folderAbsPath = path.join(paths.notesRoot, folderRelativePath)
  const metaPath = path.join(folderAbsPath, META_FILE_NAME)
  const payload = serializeNotesFolderMetadata(folder)

  const yaml = require('js-yaml')
  const body = yaml
    .dump(payload, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  const nextContent = `${body}\n`

  if (fs.pathExistsSync(metaPath)) {
    const currentContent = fs.readFileSync(metaPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.ensureDirSync(folderAbsPath)
  fs.writeFileSync(metaPath, nextContent, 'utf8')
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/parser.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/parser.ts
git commit -m "feat(notes): add notes folder metadata read/write"
```

---

### Task 7: Notes search index

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/search.ts`

- [ ] **Step 1: Create notes search module**

Create `src/main/storage/providers/markdown/notes/runtime/search.ts`. Reuses the same trigram + word matching algorithm from snippet search:

```typescript
import type { MarkdownNote, NotesRuntimeCache, NotesState } from './types'
import {
  SEARCH_DIACRITICS_RE,
  SEARCH_WORD_RE,
} from '../../runtime/constants'
import { notesRuntimeRef } from './constants'

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(SEARCH_DIACRITICS_RE, '')
    .toLowerCase()
}

function splitSearchWords(value: string): string[] {
  return value.match(SEARCH_WORD_RE) || []
}

function createWordTrigrams(word: string): string[] {
  const trigrams: string[] = []
  if (word.length < 3) {
    trigrams.push(word)
    return trigrams
  }

  for (let i = 0; i <= word.length - 3; i++) {
    trigrams.push(word.slice(i, i + 3))
  }

  return trigrams
}

function buildSearchTokens(normalizedText: string): Set<string> {
  const tokens = new Set<string>()
  const words = splitSearchWords(normalizedText)

  for (const word of words) {
    tokens.add(`w:${word}`)
    for (const trigram of createWordTrigrams(word)) {
      tokens.add(`g:${trigram}`)
    }
  }

  return tokens
}

function buildNoteSearchText(note: MarkdownNote): string {
  const parts: string[] = [note.name]
  if (note.description) {
    parts.push(note.description)
  }
  if (note.content) {
    parts.push(note.content)
  }
  return parts.join(' ')
}

export function buildNotesSearchIndex(notes: MarkdownNote[]): {
  searchTokenToNoteIds: Map<string, Set<number>>
  searchTokensByNoteId: Map<number, string[]>
  searchNoteTextById: Map<number, string>
} {
  const searchTokenToNoteIds = new Map<string, Set<number>>()
  const searchTokensByNoteId = new Map<number, string[]>()
  const searchNoteTextById = new Map<number, string>()

  for (const note of notes) {
    const rawText = buildNoteSearchText(note)
    const normalizedText = normalizeSearchValue(rawText)
    searchNoteTextById.set(note.id, normalizedText)

    const tokens = buildSearchTokens(normalizedText)
    const tokenArray = [...tokens]
    searchTokensByNoteId.set(note.id, tokenArray)

    for (const token of tokenArray) {
      let noteIds = searchTokenToNoteIds.get(token)
      if (!noteIds) {
        noteIds = new Set()
        searchTokenToNoteIds.set(token, noteIds)
      }
      noteIds.add(note.id)
    }
  }

  return { searchTokenToNoteIds, searchTokensByNoteId, searchNoteTextById }
}

export function invalidateNotesSearchIndex(_state: NotesState): void {
  const cache = notesRuntimeRef.cache
  if (cache) {
    cache.searchIndexDirty = true
    cache.searchQueryCache.clear()
  }
}

function ensureNotesSearchIndex(notes: MarkdownNote[]): void {
  const cache = notesRuntimeRef.cache
  if (!cache || !cache.searchIndexDirty) {
    return
  }

  const index = buildNotesSearchIndex(notes)
  cache.searchTokenToNoteIds = index.searchTokenToNoteIds
  cache.searchTokensByNoteId = index.searchTokensByNoteId
  cache.searchNoteTextById = index.searchNoteTextById
  cache.searchIndexDirty = false
}

export function getNoteIdsBySearchQuery(
  notes: MarkdownNote[],
  searchQuery: string,
): number[] {
  const cache = notesRuntimeRef.cache
  if (!cache) {
    return []
  }

  const normalizedQuery = normalizeSearchValue(searchQuery.trim())
  if (!normalizedQuery) {
    return notes.map(n => n.id)
  }

  const cached = cache.searchQueryCache.get(normalizedQuery)
  if (cached) {
    return cached
  }

  ensureNotesSearchIndex(notes)

  const queryWords = splitSearchWords(normalizedQuery)
  if (queryWords.length === 0) {
    return notes.map(n => n.id)
  }

  let candidateIds: Set<number> | null = null

  for (const word of queryWords) {
    const wordCandidates = new Set<number>()
    const trigrams = createWordTrigrams(word)

    for (const trigram of trigrams) {
      const token = `g:${trigram}`
      const noteIds = cache.searchTokenToNoteIds.get(token)
      if (noteIds) {
        for (const id of noteIds) {
          wordCandidates.add(id)
        }
      }
    }

    if (candidateIds === null) {
      candidateIds = wordCandidates
    }
    else {
      for (const id of candidateIds) {
        if (!wordCandidates.has(id)) {
          candidateIds.delete(id)
        }
      }
    }
  }

  if (!candidateIds || candidateIds.size === 0) {
    cache.searchQueryCache.set(normalizedQuery, [])
    return []
  }

  // Filter by full text match
  const results: number[] = []
  for (const id of candidateIds) {
    const text = cache.searchNoteTextById.get(id)
    if (!text) {
      continue
    }

    const allWordsMatch = queryWords.every(word => text.includes(word))
    if (allWordsMatch) {
      results.push(id)
    }
  }

  cache.searchQueryCache.set(normalizedQuery, results)
  return results
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/search.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/search.ts
git commit -m "feat(notes): add notes search index with trigram matching"
```

---

### Task 8: Notes sync and runtime cache

**Files:**
- Create: `src/main/storage/providers/markdown/notes/runtime/sync.ts`

- [ ] **Step 1: Create notes sync module**

Create `src/main/storage/providers/markdown/notes/runtime/sync.ts`. This is analogous to snippet `sync.ts` — syncs folders with disk, loads notes, builds runtime cache:

```typescript
import type {
  NotesFolderDiskEntry,
  NotesFolderRecord,
  NotesPaths,
  NotesRuntimeCache,
  NotesState,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { normalizeFlag, normalizeNumber, normalizeFolderOrderIndices } from '../../runtime/normalizers'
import { META_DIR_NAME, notesRuntimeRef } from './constants'
import { readNotesFolderMetadata, writeNotesFolderMetadataFile } from './parser'
import { buildNotesFolderPathMap, buildPathToNotesFolderIdMap } from './paths'
import { buildNotesSearchIndex } from './search'
import { loadNotesState, saveNotesState } from './state'
import { listNoteMarkdownFiles, loadNotes, readNoteFromFile } from './notes'

function toPosixPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

function depthOfRelativePath(relativePath: string): number {
  if (!relativePath) {
    return 0
  }
  return relativePath.split('/').length
}

function listUserFolders(notesRoot: string): NotesFolderDiskEntry[] {
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
    entry.metadata = readNotesFolderMetadata({ notesRoot } as NotesPaths, entry.path)
  }

  return result
}

export function syncNotesFoldersWithDisk(
  paths: NotesPaths,
  state: NotesState,
): void {
  const diskFolders = listUserFolders(paths.notesRoot)

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
    const parentId = parentPath === '.' ? null : (resolvedIdByPath.get(parentPath) ?? null)

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
        : normalizeFlag(previousFolder?.isOpen ?? metadata.orderIndex),
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

function syncNotesWithDisk(
  paths: NotesPaths,
  state: NotesState,
): void {
  const mdFiles = listNoteMarkdownFiles(paths.notesRoot)
  const pathToFolderIdMap = buildPathToNotesFolderIdMap(state)

  // Build existing path → id map from state
  const existingByPath = new Map<string, number>()
  state.notes.forEach(entry => existingByPath.set(entry.filePath, entry.id))

  const nextNotes: { id: number; filePath: string }[] = []
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
          const yaml = require('js-yaml')
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
  notes: import('./types').MarkdownNote[],
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
  if (notesRuntimeRef.cache && notesRuntimeRef.cache.paths.notesRoot === paths.notesRoot) {
    return notesRuntimeRef.cache
  }

  return syncNotesRuntimeWithDisk(paths)
}

export function resetNotesRuntimeCache(): void {
  notesRuntimeRef.cache = null
}
```

- [ ] **Step 2: Create runtime barrel export**

Create `src/main/storage/providers/markdown/notes/runtime/index.ts`:

```typescript
export * from './constants'
export * from './notes'
export * from './parser'
export * from './paths'
export * from './search'
export * from './state'
export * from './sync'
export * from './types'
```

- [ ] **Step 3: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/runtime/`

- [ ] **Step 4: Commit**

```bash
git add src/main/storage/providers/markdown/notes/runtime/
git commit -m "feat(notes): add notes sync, runtime cache, and barrel export"
```

---

## Chunk 2: Storage CRUD and Watcher Fix

### Task 9: Notes folders CRUD storage

**Files:**
- Create: `src/main/storage/providers/markdown/notes/storages/folders.ts`

- [ ] **Step 1: Create notes folders storage**

Create `src/main/storage/providers/markdown/notes/storages/folders.ts`. Follow the exact pattern from snippet `storages/folders.ts` but use `NotesFolderRecord` and `NotesPaths`:

```typescript
import type {
  NoteFolderCreateInput,
  NoteFolderUpdateInput,
  NoteFolderUpdateResult,
  NotesFoldersStorage,
} from '../../../../contracts'
import type { NotesFolderRecord, NotesFolderTreeRecord } from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { validateEntryName } from '../../runtime/validation'
import { throwStorageError } from '../../runtime/validation'
import { getVaultPath } from '../../runtime/paths'
import { getNotesPaths } from '../runtime/constants'
import {
  NOTES_RESERVED_ROOT_NAMES,
  META_DIR_NAME,
} from '../runtime/constants'
import {
  buildNotesFolderPathMap,
  findNotesFolderById,
  getNextNotesFolderOrder,
  getNotesFolderSiblings,
} from '../runtime/paths'
import { writeNotesFolderMetadataFile } from '../runtime/parser'
import { getNotesRuntimeCache } from '../runtime/sync'
import { saveNotesState } from '../runtime/state'
import { persistNote } from '../runtime/notes'

function assertNotReservedRootName(parentId: number | null, name: string): void {
  const normalizedName = name.toLowerCase()

  if (normalizedName === META_DIR_NAME) {
    throwStorageError('RESERVED_NAME', 'This folder name is reserved')
  }

  if (parentId === null && NOTES_RESERVED_ROOT_NAMES.has(normalizedName)) {
    throwStorageError('RESERVED_NAME', 'This folder name is reserved for technical folder')
  }
}

function assertUniqueSiblingName(
  state: import('../runtime/types').NotesState,
  parentId: number | null,
  name: string,
  excludeId?: number,
): void {
  const normalizedName = name.toLowerCase()
  const hasConflict = getNotesFolderSiblings(state, parentId, excludeId).some(
    folder => folder.name.toLowerCase() === normalizedName,
  )

  if (hasConflict) {
    throwStorageError('NAME_CONFLICT', 'Folder with this name already exists on this level')
  }
}

function createFolderTree(folders: NotesFolderRecord[]): NotesFolderTreeRecord[] {
  const childrenMap = new Map<number | null, NotesFolderTreeRecord[]>()

  for (const folder of folders) {
    const treeItem: NotesFolderTreeRecord = { ...folder, children: [] }
    const siblings = childrenMap.get(folder.parentId)
    if (siblings) {
      siblings.push(treeItem)
    }
    else {
      childrenMap.set(folder.parentId, [treeItem])
    }
  }

  function attachChildren(items: NotesFolderTreeRecord[]): void {
    for (const item of items) {
      const children = childrenMap.get(item.id)
      if (children) {
        children.sort((a, b) => a.orderIndex - b.orderIndex)
        item.children = children
        attachChildren(children)
      }
    }
  }

  const roots = childrenMap.get(null) || []
  roots.sort((a, b) => a.orderIndex - b.orderIndex)
  attachChildren(roots)

  return roots
}

export function createNotesFoldersStorage(): NotesFoldersStorage {
  function getPaths() {
    return getNotesPaths(getVaultPath())
  }

  function getCache() {
    return getNotesRuntimeCache(getPaths())
  }

  return {
    getFolders() {
      const { state } = getCache()
      return [...state.folders].sort((a, b) => b.createdAt - a.createdAt)
    },

    getFoldersTree() {
      const { state } = getCache()
      const sorted = [...state.folders].sort((a, b) => a.orderIndex - b.orderIndex)
      return createFolderTree(sorted)
    },

    createFolder(input: NoteFolderCreateInput) {
      const paths = getPaths()
      const { state } = getNotesRuntimeCache(paths)

      const name = validateEntryName(input.name, 'folder')
      const parentId = input.parentId ?? null

      assertNotReservedRootName(parentId, name)
      assertUniqueSiblingName(state, parentId, name)

      if (parentId !== null) {
        const parent = findNotesFolderById(state, parentId)
        if (!parent) {
          throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
        }
      }

      // Create directory on disk
      const folderPathMap = buildNotesFolderPathMap(state)
      const parentPath = parentId !== null ? folderPathMap.get(parentId) : undefined
      const folderRelativePath = parentPath
        ? path.posix.join(parentPath, name)
        : name
      const folderAbsPath = path.join(paths.notesRoot, folderRelativePath)
      fs.ensureDirSync(folderAbsPath)

      state.counters.folderId += 1
      const folderId = state.counters.folderId
      const now = Date.now()

      const folder: NotesFolderRecord = {
        id: folderId,
        name,
        parentId,
        icon: null,
        isOpen: 0,
        orderIndex: getNextNotesFolderOrder(state, parentId),
        createdAt: now,
        updatedAt: now,
      }

      state.folders.push(folder)
      writeNotesFolderMetadataFile(paths, folderRelativePath, folder)
      saveNotesState(paths, state)

      return { id: folderId }
    },

    updateFolder(id: number, input: NoteFolderUpdateInput): NoteFolderUpdateResult {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const folder = findNotesFolderById(state, id)

      if (!folder) {
        return { invalidInput: false, notFound: true }
      }

      const now = Date.now()
      let pathChanged = false

      if (input.name !== undefined) {
        const name = validateEntryName(input.name, 'folder')
        const parentId = input.parentId !== undefined ? (input.parentId ?? null) : folder.parentId

        assertNotReservedRootName(parentId, name)
        assertUniqueSiblingName(state, parentId, name, id)

        if (name !== folder.name) {
          pathChanged = true
        }

        folder.name = name
      }

      if (input.parentId !== undefined) {
        const newParentId = input.parentId ?? null

        if (newParentId !== folder.parentId) {
          pathChanged = true
          folder.parentId = newParentId
        }
      }

      if (input.icon !== undefined) {
        folder.icon = input.icon
      }

      if (input.isOpen !== undefined) {
        folder.isOpen = normalizeFlag(input.isOpen)
      }

      if (input.orderIndex !== undefined) {
        folder.orderIndex = normalizeNumber(input.orderIndex, folder.orderIndex)
      }

      folder.updatedAt = now

      if (pathChanged) {
        // Rebuild folder paths and move directory
        const oldFolderPathMap = buildNotesFolderPathMap(state)
        const oldPath = oldFolderPathMap.get(id)

        // Recalculate after change
        const newFolderPathMap = buildNotesFolderPathMap(state)
        const newPath = newFolderPathMap.get(id)

        if (oldPath && newPath && oldPath !== newPath) {
          const oldAbsPath = path.join(paths.notesRoot, oldPath)
          const newAbsPath = path.join(paths.notesRoot, newPath)

          if (fs.pathExistsSync(oldAbsPath)) {
            fs.ensureDirSync(path.dirname(newAbsPath))
            fs.moveSync(oldAbsPath, newAbsPath)
          }

          // Update note file paths
          for (const note of notes) {
            if (note.filePath.startsWith(oldPath + '/') || note.filePath.startsWith(`${oldPath}/`)) {
              const newFilePath = note.filePath.replace(oldPath, newPath)
              note.filePath = newFilePath

              const indexEntry = state.notes.find(n => n.id === note.id)
              if (indexEntry) {
                indexEntry.filePath = newFilePath
              }
            }
          }
        }

        // Write metadata for moved folder
        const finalPath = newFolderPathMap.get(id)
        if (finalPath) {
          writeNotesFolderMetadataFile(paths, finalPath, folder)
        }
      }
      else {
        // Just write metadata in place
        const folderPathMap = buildNotesFolderPathMap(state)
        const folderPath = folderPathMap.get(id)
        if (folderPath) {
          writeNotesFolderMetadataFile(paths, folderPath, folder)
        }
      }

      saveNotesState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    deleteFolder(id: number) {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const folder = findNotesFolderById(state, id)

      if (!folder) {
        return { deleted: false }
      }

      // Find all descendant folder IDs
      const descendantIds = new Set<number>()
      function findDescendants(parentId: number): void {
        for (const f of state.folders) {
          if (f.parentId === parentId && !descendantIds.has(f.id)) {
            descendantIds.add(f.id)
            findDescendants(f.id)
          }
        }
      }
      findDescendants(id)
      descendantIds.add(id)

      // Move notes to trash
      for (const note of notes) {
        if (note.folderId !== null && descendantIds.has(note.folderId)) {
          const previousFilePath = note.filePath
          note.folderId = null
          note.isDeleted = 1
          note.updatedAt = Date.now()
          persistNote(paths, state, note, previousFilePath, { allowRenameOnConflict: true })
        }
      }

      // Delete folder directories (deepest first)
      const folderPathMap = buildNotesFolderPathMap(state)
      const foldersToDelete = state.folders
        .filter(f => descendantIds.has(f.id))
        .sort((a, b) => {
          const pathA = folderPathMap.get(a.id) || ''
          const pathB = folderPathMap.get(b.id) || ''
          return pathB.split('/').length - pathA.split('/').length
        })

      for (const f of foldersToDelete) {
        const folderPath = folderPathMap.get(f.id)
        if (folderPath) {
          const absPath = path.join(paths.notesRoot, folderPath)
          if (fs.pathExistsSync(absPath)) {
            try {
              fs.removeSync(absPath)
            }
            catch {
              // Non-critical
            }
          }
        }
      }

      // Remove from state
      state.folders = state.folders.filter(f => !descendantIds.has(f.id))
      saveNotesState(paths, state)

      return { deleted: true }
    },
  }
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/storages/folders.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/storages/folders.ts
git commit -m "feat(notes): add notes folders CRUD storage"
```

---

### Task 10: Notes CRUD storage

**Files:**
- Create: `src/main/storage/providers/markdown/notes/storages/notes.ts`

- [ ] **Step 1: Create notes storage**

Create `src/main/storage/providers/markdown/notes/storages/notes.ts`:

```typescript
import type {
  NoteCreateInput,
  NoteRecord,
  NoteTagDeleteRelationResult,
  NoteTagRelationResult,
  NotesCount,
  NotesQueryInput,
  NotesStorage,
  NoteUpdateInput,
  NoteUpdateResult,
} from '../../../../contracts'
import type { MarkdownNote } from '../runtime/types'
import fs from 'fs-extra'
import path from 'node:path'
import { normalizeFlag } from '../../runtime/normalizers'
import { validateEntryName } from '../../runtime/validation'
import { getVaultPath } from '../../runtime/paths'
import { getNotesPaths } from '../runtime/constants'
import { findNoteById, persistNote, serializeNote, writeNoteToFile } from '../runtime/notes'
import { findNotesFolderById } from '../runtime/paths'
import { getNotesRuntimeCache } from '../runtime/sync'
import { saveNotesState } from '../runtime/state'
import { getNoteIdsBySearchQuery } from '../runtime/search'

function createNoteRecord(
  note: MarkdownNote,
  state: import('../runtime/types').NotesState,
): NoteRecord {
  let folder: { id: number; name: string } | null = null
  if (note.folderId !== null) {
    const f = findNotesFolderById(state, note.folderId)
    if (f) {
      folder = { id: f.id, name: f.name }
    }
  }

  const tags = note.tags
    .map((tagId) => {
      const t = state.tags.find(tag => tag.id === tagId)
      return t ? { id: t.id, name: t.name } : null
    })
    .filter(Boolean) as { id: number; name: string }[]

  return {
    id: note.id,
    name: note.name,
    description: note.description,
    content: note.content,
    tags,
    folder,
    isFavorites: note.isFavorites,
    isDeleted: note.isDeleted,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

export function createNotesNotesStorage(): NotesStorage {
  function getPaths() {
    return getNotesPaths(getVaultPath())
  }

  function getCache() {
    return getNotesRuntimeCache(getPaths())
  }

  return {
    getNotes(query: NotesQueryInput): NoteRecord[] {
      const { state, notes } = getCache()

      let filtered = notes

      if (query.isDeleted !== undefined) {
        filtered = filtered.filter(n => n.isDeleted === normalizeFlag(query.isDeleted))
      }
      else {
        filtered = filtered.filter(n => n.isDeleted === 0)
      }

      if (query.folderId !== undefined) {
        filtered = filtered.filter(n => n.folderId === query.folderId)
      }

      if (query.isInbox !== undefined && query.isInbox) {
        filtered = filtered.filter(n => n.folderId === null && n.isDeleted === 0)
      }

      if (query.isFavorites !== undefined && query.isFavorites) {
        filtered = filtered.filter(n => n.isFavorites === 1)
      }

      if (query.tagId !== undefined) {
        filtered = filtered.filter(n => n.tags.includes(query.tagId!))
      }

      if (query.search) {
        const matchedIds = new Set(getNoteIdsBySearchQuery(notes, query.search))
        filtered = filtered.filter(n => matchedIds.has(n.id))
      }

      const order = query.order === 'ASC' ? 1 : -1
      filtered.sort((a, b) => (a.updatedAt - b.updatedAt) * order)

      return filtered.map(n => createNoteRecord(n, state))
    },

    getNotesCounts(): NotesCount {
      const { notes } = getCache()
      const total = notes.filter(n => n.isDeleted === 0).length
      const trash = notes.filter(n => n.isDeleted === 1).length
      return { total, trash }
    },

    createNote(input: NoteCreateInput) {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)

      const name = validateEntryName(input.name, 'note')
      const folderId = input.folderId ?? null

      if (folderId !== null) {
        const folder = findNotesFolderById(state, folderId)
        if (!folder) {
          folderId === null
        }
      }

      state.counters.noteId += 1
      const noteId = state.counters.noteId
      const now = Date.now()

      const note: MarkdownNote = {
        content: '',
        createdAt: now,
        description: null,
        filePath: '',
        folderId,
        id: noteId,
        isDeleted: 0,
        isFavorites: 0,
        name,
        tags: [],
        updatedAt: now,
      }

      persistNote(paths, state, note, undefined, { allowRenameOnConflict: true })
      notes.push(note)
      saveNotesState(paths, state)

      return { id: noteId }
    },

    updateNote(id: number, input: NoteUpdateInput): NoteUpdateResult {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      if (!note) {
        return { invalidInput: false, notFound: true }
      }

      const previousFilePath = note.filePath
      let pathMayChange = false

      if (input.name !== undefined) {
        note.name = validateEntryName(input.name, 'note')
        pathMayChange = true
      }

      if (input.description !== undefined) {
        note.description = input.description
      }

      if (input.folderId !== undefined) {
        note.folderId = input.folderId
        pathMayChange = true
      }

      if (input.isFavorites !== undefined) {
        note.isFavorites = normalizeFlag(input.isFavorites)
      }

      if (input.isDeleted !== undefined) {
        note.isDeleted = normalizeFlag(input.isDeleted)
        pathMayChange = true
      }

      note.updatedAt = Date.now()

      if (pathMayChange) {
        persistNote(paths, state, note, previousFilePath, { allowRenameOnConflict: true })
      }
      else {
        writeNoteToFile(paths, note)
      }

      saveNotesState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    updateNoteContent(id: number, content: string): NoteUpdateResult {
      const paths = getPaths()
      const { notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      if (!note) {
        return { invalidInput: false, notFound: true }
      }

      note.content = content
      note.updatedAt = Date.now()
      writeNoteToFile(paths, note)

      return { invalidInput: false, notFound: false }
    },

    deleteNote(id: number) {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, id)

      if (!note) {
        return { deleted: false }
      }

      // Remove file
      const absolutePath = path.join(paths.notesRoot, note.filePath)
      if (fs.pathExistsSync(absolutePath)) {
        fs.removeSync(absolutePath)
      }

      // Remove from state and runtime
      state.notes = state.notes.filter(n => n.id !== id)
      const noteIndex = notes.indexOf(note)
      if (noteIndex !== -1) {
        notes.splice(noteIndex, 1)
      }

      saveNotesState(paths, state)
      return { deleted: true }
    },

    emptyTrash() {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)

      const trashNotes = notes.filter(n => n.isDeleted === 1)
      let deletedCount = 0

      for (const note of trashNotes) {
        const absolutePath = path.join(paths.notesRoot, note.filePath)
        if (fs.pathExistsSync(absolutePath)) {
          fs.removeSync(absolutePath)
        }

        state.notes = state.notes.filter(n => n.id !== note.id)
        const index = notes.indexOf(note)
        if (index !== -1) {
          notes.splice(index, 1)
        }

        deletedCount += 1
      }

      saveNotesState(paths, state)
      return { deletedCount }
    },

    addTagToNote(noteId: number, tagId: number): NoteTagRelationResult {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, noteId)
      const tag = state.tags.find(t => t.id === tagId)

      if (!note || !tag) {
        return { notFound: false, noteFound: !!note, tagFound: !!tag }
      }

      if (!note.tags.includes(tagId)) {
        note.tags.push(tagId)
        note.updatedAt = Date.now()
        writeNoteToFile(paths, note)
      }

      return { notFound: false, noteFound: true, tagFound: true }
    },

    deleteTagFromNote(noteId: number, tagId: number): NoteTagDeleteRelationResult {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const note = findNoteById(notes, noteId)
      const tag = state.tags.find(t => t.id === tagId)

      if (!note || !tag) {
        return { notFound: false, noteFound: !!note, tagFound: !!tag, relationFound: false }
      }

      const tagIndex = note.tags.indexOf(tagId)
      if (tagIndex === -1) {
        return { notFound: false, noteFound: true, tagFound: true, relationFound: false }
      }

      note.tags.splice(tagIndex, 1)
      note.updatedAt = Date.now()
      writeNoteToFile(paths, note)

      return { notFound: false, noteFound: true, tagFound: true, relationFound: true }
    },
  }
}
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/storages/notes.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/notes/storages/notes.ts
git commit -m "feat(notes): add notes CRUD storage"
```

---

### Task 11: Notes tags storage

**Files:**
- Create: `src/main/storage/providers/markdown/notes/storages/tags.ts`

- [ ] **Step 1: Create notes tags storage**

Create `src/main/storage/providers/markdown/notes/storages/tags.ts`:

```typescript
import type { NoteTagsStorage } from '../../../../contracts'
import { getVaultPath } from '../../runtime/paths'
import { getNotesPaths } from '../runtime/constants'
import { writeNoteToFile } from '../runtime/notes'
import { getNotesRuntimeCache } from '../runtime/sync'
import { saveNotesState } from '../runtime/state'

export function createNoteTagsStorage(): NoteTagsStorage {
  function getPaths() {
    return getNotesPaths(getVaultPath())
  }

  function getCache() {
    return getNotesRuntimeCache(getPaths())
  }

  return {
    getTags() {
      const { state } = getCache()
      return [...state.tags].sort((a, b) => a.name.localeCompare(b.name))
    },

    createTag(name: string) {
      const paths = getPaths()
      const { state } = getNotesRuntimeCache(paths)

      state.counters.tagId += 1
      const tagId = state.counters.tagId
      const now = Date.now()

      state.tags.push({
        id: tagId,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
      })

      saveNotesState(paths, state)
      return { id: tagId }
    },

    updateTag(id: number, name: string) {
      const paths = getPaths()
      const { state } = getNotesRuntimeCache(paths)
      const tag = state.tags.find(t => t.id === id)

      if (!tag) {
        return { notFound: true }
      }

      tag.name = name.trim()
      tag.updatedAt = Date.now()
      saveNotesState(paths, state)

      return { notFound: false }
    },

    deleteTag(id: number) {
      const paths = getPaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const tagIndex = state.tags.findIndex(t => t.id === id)

      if (tagIndex === -1) {
        return { deleted: false }
      }

      state.tags.splice(tagIndex, 1)

      // Remove tag from all notes
      for (const note of notes) {
        const idx = note.tags.indexOf(id)
        if (idx !== -1) {
          note.tags.splice(idx, 1)
          writeNoteToFile(paths, note)
        }
      }

      saveNotesState(paths, state)
      return { deleted: true }
    },
  }
}
```

- [ ] **Step 2: Create notes storage provider index**

Create `src/main/storage/providers/markdown/notes/storages/index.ts`:

```typescript
import type { NotesStorageProvider } from '../../../../contracts'
import { createNotesFoldersStorage } from './folders'
import { createNotesNotesStorage } from './notes'
import { createNoteTagsStorage } from './tags'

export function createNotesStorageProvider(): NotesStorageProvider {
  return {
    folders: createNotesFoldersStorage(),
    notes: createNotesNotesStorage(),
    tags: createNoteTagsStorage(),
  }
}
```

- [ ] **Step 3: Create notes package barrel export**

Create `src/main/storage/providers/markdown/notes/index.ts`:

```typescript
export { createNotesStorageProvider } from './storages'
export { getNotesRuntimeCache, resetNotesRuntimeCache, syncNotesRuntimeWithDisk } from './runtime/sync'
export { getNotesPaths } from './runtime/constants'
```

- [ ] **Step 4: Add useNotesStorage function**

Add to `src/main/storage/index.ts`:

```typescript
import type { NotesStorageProvider } from './contracts'
import { createNotesStorageProvider } from './providers/markdown/notes'

const notesStorageProvider = createNotesStorageProvider()

export function useNotesStorage(): NotesStorageProvider {
  return notesStorageProvider
}
```

- [ ] **Step 5: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/ src/main/storage/index.ts`

- [ ] **Step 6: Commit**

```bash
git add src/main/storage/providers/markdown/notes/ src/main/storage/index.ts
git commit -m "feat(notes): add notes tags storage and useNotesStorage accessor"
```

---

### Task 12: Fix watcher to ignore notes directory

**Files:**
- Modify: `src/main/storage/providers/markdown/watcher.ts`

- [ ] **Step 1: Update shouldIgnoreWatchPath**

In `src/main/storage/providers/markdown/watcher.ts`, add a check to ignore `__spaces__/notes/` for snippet sync. The existing code at line 104-111 never ignores `__spaces__/`. We need to add a specific check for `__spaces__/notes/`:

After the `spacesPrefix` check (line 104-111), add:

```typescript
// Ignore __spaces__/notes/ for snippet sync (notes has its own storage)
const notesSpacePrefix = `${spacesPrefix}/notes`
if (
  normalizedRelativePath === notesSpacePrefix
  || normalizedRelativePath.startsWith(`${notesSpacePrefix}/`)
) {
  return true
}
```

This keeps `__spaces__/math/` changes propagating but ignores `__spaces__/notes/`.

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/storage/providers/markdown/watcher.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/storage/providers/markdown/watcher.ts
git commit -m "fix(notes): ignore __spaces__/notes/ in snippet watcher"
```

---

## Chunk 3: API Layer

### Task 13: Notes API DTOs

**Files:**
- Create: `src/main/api/dto/notes.ts`
- Create: `src/main/api/dto/note-folders.ts`
- Create: `src/main/api/dto/note-tags.ts`

- [ ] **Step 1: Create notes DTOs**

Create `src/main/api/dto/notes.ts`:

```typescript
import { Elysia, t } from 'elysia'
import { createIdResponse } from './common/response'
import { commonQuery } from './common/query'

const notesAdd = t.Object({
  name: t.String(),
  folderId: t.Optional(t.Nullable(t.Number())),
})

const notesUpdate = t.Object({
  name: t.Optional(t.String()),
  folderId: t.Optional(t.Nullable(t.Number())),
  description: t.Optional(t.Nullable(t.String())),
  isDeleted: t.Optional(t.Number()),
  isFavorites: t.Optional(t.Number()),
})

const notesContentUpdate = t.Object({
  content: t.String(),
})

const notesQuery = t.Object({
  ...commonQuery.properties,
  folderId: t.Optional(t.Number()),
  tagId: t.Optional(t.Number()),
  isFavorites: t.Optional(t.Number()),
  isDeleted: t.Optional(t.Number()),
  isInbox: t.Optional(t.Number()),
})

const notesCountsResponse = t.Object({
  total: t.Number(),
  trash: t.Number(),
})

export const notesDTO = new Elysia().model({
  notesAdd,
  notesUpdate,
  notesContentUpdate,
  notesQuery,
  notesCountsResponse,
  notesAddResponse: createIdResponse,
})

export type NotesAdd = typeof notesAdd.static
export type NotesUpdate = typeof notesUpdate.static
export type NotesContentUpdate = typeof notesContentUpdate.static
export type NotesQuery = typeof notesQuery.static
```

Create `src/main/api/dto/note-folders.ts`:

```typescript
import { Elysia, t } from 'elysia'
import { createIdResponse } from './common/response'

const noteFoldersAdd = t.Object({
  name: t.String(),
  parentId: t.Optional(t.Nullable(t.Number())),
})

const noteFoldersUpdate = t.Object({
  name: t.Optional(t.String()),
  icon: t.Optional(t.Nullable(t.String())),
  parentId: t.Optional(t.Nullable(t.Number())),
  isOpen: t.Optional(t.Number()),
  orderIndex: t.Optional(t.Number()),
})

export const noteFoldersDTO = new Elysia().model({
  noteFoldersAdd,
  noteFoldersUpdate,
  noteFoldersAddResponse: createIdResponse,
})

export type NoteFoldersAdd = typeof noteFoldersAdd.static
export type NoteFoldersUpdate = typeof noteFoldersUpdate.static
```

Create `src/main/api/dto/note-tags.ts`:

```typescript
import { Elysia, t } from 'elysia'
import { createIdResponse } from './common/response'

const noteTagsAdd = t.Object({
  name: t.String(),
})

const noteTagsUpdate = t.Object({
  name: t.String(),
})

export const noteTagsDTO = new Elysia().model({
  noteTagsAdd,
  noteTagsUpdate,
  noteTagsAddResponse: createIdResponse,
})

export type NoteTagsAdd = typeof noteTagsAdd.static
export type NoteTagsUpdate = typeof noteTagsUpdate.static
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/main/api/dto/notes.ts src/main/api/dto/note-folders.ts src/main/api/dto/note-tags.ts`

- [ ] **Step 3: Commit**

```bash
git add src/main/api/dto/notes.ts src/main/api/dto/note-folders.ts src/main/api/dto/note-tags.ts
git commit -m "feat(notes): add API DTOs for notes, note-folders, note-tags"
```

---

### Task 14: Notes API routes

**Files:**
- Create: `src/main/api/routes/notes.ts`
- Create: `src/main/api/routes/note-folders.ts`
- Create: `src/main/api/routes/note-tags.ts`
- Modify: `src/main/api/index.ts`

- [ ] **Step 1: Create notes routes**

Create `src/main/api/routes/notes.ts` following the snippets route pattern:

```typescript
import { Elysia } from 'elysia'
import { notesDTO } from '../dto/notes'
import { useNotesStorage } from '../../storage'

function parseStorageError(error: unknown): { code: string; message: string } {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  const colonIndex = msg.indexOf(':')
  if (colonIndex === -1) {
    return { code: 'UNKNOWN', message: msg }
  }
  return { code: msg.slice(0, colonIndex), message: msg.slice(colonIndex + 1) }
}

function mapStorageError(error: unknown) {
  const { code, message } = parseStorageError(error)
  const statusMap: Record<string, number> = {
    NAME_CONFLICT: 409,
    FOLDER_NOT_FOUND: 404,
    INVALID_NAME: 400,
    RESERVED_NAME: 400,
    NOTE_NOT_FOUND: 404,
  }
  const status = statusMap[code] || 500
  return { status, body: { error: code, message } }
}

export default new Elysia({ prefix: '/notes' })
  .use(notesDTO)
  .get('/', ({ query }) => {
    const storage = useNotesStorage()
    return storage.notes.getNotes(query)
  }, {
    query: 'notesQuery',
    detail: { tags: ['Notes'] },
  })
  .get('/counts', () => {
    const storage = useNotesStorage()
    return storage.notes.getNotesCounts()
  }, {
    detail: { tags: ['Notes'] },
  })
  .post('/', ({ body, set }) => {
    try {
      const storage = useNotesStorage()
      const result = storage.notes.createNote(body)
      set.status = 201
      return result
    }
    catch (error) {
      const mapped = mapStorageError(error)
      set.status = mapped.status
      return mapped.body
    }
  }, {
    body: 'notesAdd',
    detail: { tags: ['Notes'] },
  })
  .patch('/:id', ({ params, body, set }) => {
    try {
      const storage = useNotesStorage()
      const result = storage.notes.updateNote(Number(params.id), body)
      if (result.notFound) {
        set.status = 404
        return { error: 'NOT_FOUND', message: 'Note not found' }
      }
      return { success: true }
    }
    catch (error) {
      const mapped = mapStorageError(error)
      set.status = mapped.status
      return mapped.body
    }
  }, {
    body: 'notesUpdate',
    detail: { tags: ['Notes'] },
  })
  .patch('/:id/content', ({ params, body, set }) => {
    const storage = useNotesStorage()
    const result = storage.notes.updateNoteContent(Number(params.id), body.content)
    if (result.notFound) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Note not found' }
    }
    return { success: true }
  }, {
    body: 'notesContentUpdate',
    detail: { tags: ['Notes'] },
  })
  .delete('/:id', ({ params, set }) => {
    const storage = useNotesStorage()
    const result = storage.notes.deleteNote(Number(params.id))
    if (!result.deleted) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Note not found' }
    }
    return { success: true }
  }, {
    detail: { tags: ['Notes'] },
  })
  .delete('/trash', () => {
    const storage = useNotesStorage()
    return storage.notes.emptyTrash()
  }, {
    detail: { tags: ['Notes'] },
  })
  .post('/:id/tags/:tagId', ({ params, set }) => {
    const storage = useNotesStorage()
    const result = storage.notes.addTagToNote(Number(params.id), Number(params.tagId))
    if (!result.noteFound) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Note not found' }
    }
    if (!result.tagFound) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Tag not found' }
    }
    return { success: true }
  }, {
    detail: { tags: ['Notes'] },
  })
  .delete('/:id/tags/:tagId', ({ params, set }) => {
    const storage = useNotesStorage()
    const result = storage.notes.deleteTagFromNote(Number(params.id), Number(params.tagId))
    if (!result.noteFound) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Note not found' }
    }
    return { success: true }
  }, {
    detail: { tags: ['Notes'] },
  })
```

- [ ] **Step 2: Create note-folders routes**

Create `src/main/api/routes/note-folders.ts`:

```typescript
import { Elysia } from 'elysia'
import { noteFoldersDTO } from '../dto/note-folders'
import { useNotesStorage } from '../../storage'

function parseStorageError(error: unknown): { code: string; message: string } {
  const msg = error instanceof Error ? error.message : 'Unknown error'
  const colonIndex = msg.indexOf(':')
  if (colonIndex === -1) {
    return { code: 'UNKNOWN', message: msg }
  }
  return { code: msg.slice(0, colonIndex), message: msg.slice(colonIndex + 1) }
}

function mapStorageError(error: unknown) {
  const { code, message } = parseStorageError(error)
  const statusMap: Record<string, number> = {
    NAME_CONFLICT: 409,
    FOLDER_NOT_FOUND: 404,
    INVALID_NAME: 400,
    RESERVED_NAME: 400,
  }
  const status = statusMap[code] || 500
  return { status, body: { error: code, message } }
}

export default new Elysia({ prefix: '/note-folders' })
  .use(noteFoldersDTO)
  .get('/', () => {
    const storage = useNotesStorage()
    return storage.folders.getFolders()
  }, {
    detail: { tags: ['Note Folders'] },
  })
  .get('/tree', () => {
    const storage = useNotesStorage()
    return storage.folders.getFoldersTree()
  }, {
    detail: { tags: ['Note Folders'] },
  })
  .post('/', ({ body, set }) => {
    try {
      const storage = useNotesStorage()
      const result = storage.folders.createFolder(body)
      set.status = 201
      return result
    }
    catch (error) {
      const mapped = mapStorageError(error)
      set.status = mapped.status
      return mapped.body
    }
  }, {
    body: 'noteFoldersAdd',
    detail: { tags: ['Note Folders'] },
  })
  .patch('/:id', ({ params, body, set }) => {
    try {
      const storage = useNotesStorage()
      const result = storage.folders.updateFolder(Number(params.id), body)
      if (result.notFound) {
        set.status = 404
        return { error: 'NOT_FOUND', message: 'Folder not found' }
      }
      return { success: true }
    }
    catch (error) {
      const mapped = mapStorageError(error)
      set.status = mapped.status
      return mapped.body
    }
  }, {
    body: 'noteFoldersUpdate',
    detail: { tags: ['Note Folders'] },
  })
  .delete('/:id', ({ params, set }) => {
    const storage = useNotesStorage()
    const result = storage.folders.deleteFolder(Number(params.id))
    if (!result.deleted) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Folder not found' }
    }
    return { success: true }
  }, {
    detail: { tags: ['Note Folders'] },
  })
```

- [ ] **Step 3: Create note-tags routes**

Create `src/main/api/routes/note-tags.ts`:

```typescript
import { Elysia } from 'elysia'
import { noteTagsDTO } from '../dto/note-tags'
import { useNotesStorage } from '../../storage'

export default new Elysia({ prefix: '/note-tags' })
  .use(noteTagsDTO)
  .get('/', () => {
    const storage = useNotesStorage()
    return storage.tags.getTags()
  }, {
    detail: { tags: ['Note Tags'] },
  })
  .post('/', ({ body, set }) => {
    const storage = useNotesStorage()
    const result = storage.tags.createTag(body.name)
    set.status = 201
    return result
  }, {
    body: 'noteTagsAdd',
    detail: { tags: ['Note Tags'] },
  })
  .patch('/:id', ({ params, body, set }) => {
    const storage = useNotesStorage()
    const result = storage.tags.updateTag(Number(params.id), body.name)
    if (result.notFound) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Tag not found' }
    }
    return { success: true }
  }, {
    body: 'noteTagsUpdate',
    detail: { tags: ['Note Tags'] },
  })
  .delete('/:id', ({ params, set }) => {
    const storage = useNotesStorage()
    const result = storage.tags.deleteTag(Number(params.id))
    if (!result.deleted) {
      set.status = 404
      return { error: 'NOT_FOUND', message: 'Tag not found' }
    }
    return { success: true }
  }, {
    detail: { tags: ['Note Tags'] },
  })
```

- [ ] **Step 4: Register routes in API index**

In `src/main/api/index.ts`, add imports and `.use()` calls:

```typescript
import notes from './routes/notes'
import noteFolders from './routes/note-folders'
import noteTags from './routes/note-tags'

// In the app chain after .use(tags):
.use(notes)
.use(noteFolders)
.use(noteTags)
```

- [ ] **Step 5: Lint**

Run: `pnpm lint src/main/api/`

- [ ] **Step 6: Generate API client**

Run: `pnpm api:generate`

- [ ] **Step 7: Commit**

```bash
git add src/main/api/ src/renderer/services/api/generated/
git commit -m "feat(notes): add REST API routes for notes, note-folders, note-tags"
```

---

## Chunk 4: Frontend Foundation

### Task 15: Space registration and routing

**Files:**
- Modify: `src/renderer/spaceDefinitions.ts`
- Modify: `src/renderer/router/index.ts`
- Modify: `src/main/i18n/locales/en_US/ui.json`

- [ ] **Step 1: Add i18n keys**

In `src/main/i18n/locales/en_US/ui.json`, add to the `spaces` object:

```json
"notes": "Notes",
"notesTooltip": "Notes"
```

Add a new `notes` section at the same level as `snippet`:

```json
"notes": {
  "untitled": "Untitled note",
  "plural": "Notes",
  "emptyName": "Type note name",
  "selectedMultiple": "{{count}} Notes Selected",
  "noSelected": "No Note Selected"
}
```

Add to `placeholder`:

```json
"emptyNotesList": "No Notes",
"searchNotes": "Search notes..."
```

Add to `action.new`:

```json
"note": "New Note"
```

- [ ] **Step 2: Add RouterName and route**

In `src/renderer/router/index.ts`:

Add `notesSpace: 'notes-space'` to `RouterName` object.

Add route after the `dev` route:

```typescript
{
  path: '/notes',
  name: RouterName.notesSpace,
  component: () => import('@/views/NotesSpace.vue'),
},
```

- [ ] **Step 3: Add space definition**

In `src/renderer/spaceDefinitions.ts`:

Add `'notes'` to `SpaceId` type:

```typescript
export type SpaceId = 'code' | 'tools' | 'math' | 'dev' | 'notes'
```

Add `Notebook` to lucide import:

```typescript
import { Blocks, Calculator, Code2, FlaskConical, Notebook } from 'lucide-vue-next'
```

Add notes space definition before `dev` in the array:

```typescript
{
  id: 'notes',
  label: i18n.t('spaces.notes'),
  tooltip: i18n.t('spaces.notesTooltip'),
  icon: Notebook,
  to: { name: RouterName.notesSpace },
  isActive: routeName => routeName === RouterName.notesSpace,
},
```

- [ ] **Step 4: Create NotesSpace view**

Create `src/renderer/views/NotesSpace.vue`:

```vue
<script setup lang="ts">
</script>

<template>
  <NotesSpaceLayout />
</template>
```

- [ ] **Step 5: Lint**

Run: `pnpm lint src/renderer/spaceDefinitions.ts src/renderer/router/index.ts src/renderer/views/NotesSpace.vue`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/spaceDefinitions.ts src/renderer/router/index.ts src/main/i18n/locales/en_US/ui.json src/renderer/views/NotesSpace.vue
git commit -m "feat(notes): register notes space, routing, and i18n keys"
```

---

### Task 16: Notes composables

**Files:**
- Create: `src/renderer/composables/notes-space/useNotesApp.ts`
- Create: `src/renderer/composables/notes-space/useNoteFolders.ts`
- Create: `src/renderer/composables/notes-space/useNotes.ts`
- Create: `src/renderer/composables/notes-space/useNoteTags.ts`
- Create: `src/renderer/composables/notes-space/index.ts`
- Modify: `src/renderer/composables/index.ts`

This is a large task. The composables follow the exact pattern from `useFolders.ts`, `useSnippets.ts`, and `useTags.ts` but use the notes API endpoints. Since the API client is auto-generated, use `api.notes.*`, `api.noteFolders.*`, `api.noteTags.*`.

- [ ] **Step 1: Create useNotesApp**

Create `src/renderer/composables/notes-space/useNotesApp.ts` following the `useApp.ts` pattern but with separate `notesState`:

Module-level state: `notesState` reactive object with `{ noteId, folderId, tagId, libraryFilter }`, persisted to `store.app.get('notesState')` / `store.app.set('notesState', ...)`.

- [ ] **Step 2: Create useNoteFolders**

Create `src/renderer/composables/notes-space/useNoteFolders.ts` following `useFolders.ts` pattern:

Module-level state: `folders`, `selectedFolderIds`, `renameFolderId`, `lastSelectedFolderId`.
CRUD: `getNoteFolders()`, `createNoteFolder()`, `updateNoteFolder()`, `deleteNoteFolder()`.
Selection: single/range/toggle.

- [ ] **Step 3: Create useNotes**

Create `src/renderer/composables/notes-space/useNotes.ts` following `useSnippets.ts` pattern:

Module-level state: `notes`, `selectedNoteIds`, `searchQuery`, `isSearch`, `notesBySearch`, `searchSelectedIndex`.
CRUD: `getNotes()`, `createNote()`, `updateNote()`, `updateNoteContent()`, `deleteNote()`, `emptyTrash()`.
Selection, search, tag operations.

Key difference from snippets: no fragments, content is a single string updated via `api.notes[':id'].content.patch({ content })`.

- [ ] **Step 4: Create useNoteTags**

Create `src/renderer/composables/notes-space/useNoteTags.ts` following `useTags.ts` pattern with `updateTag` support.

- [ ] **Step 5: Create barrel export**

Create `src/renderer/composables/notes-space/index.ts`:

```typescript
export { useNotesApp } from './useNotesApp'
export { useNoteFolders } from './useNoteFolders'
export { useNotes } from './useNotes'
export { useNoteTags } from './useNoteTags'
```

Add to `src/renderer/composables/index.ts`:

```typescript
export * from './notes-space'
```

- [ ] **Step 6: Lint**

Run: `pnpm lint src/renderer/composables/notes-space/`

- [ ] **Step 7: Commit**

```bash
git add src/renderer/composables/notes-space/ src/renderer/composables/index.ts
git commit -m "feat(notes): add notes composables (useNotes, useNoteFolders, useNoteTags, useNotesApp)"
```

---

## Chunk 5: Frontend UI Components

### Task 17: Notes space layout

**Files:**
- Create: `src/renderer/components/notes-space-layout/NotesSpaceLayout.vue`

- [ ] **Step 1: Create 3-column layout**

Create `src/renderer/components/notes-space-layout/NotesSpaceLayout.vue` following `CodeSpaceLayout.vue`:

```vue
<script setup lang="ts">
import * as Resizable from '@/components/ui/shadcn/resizable'
import { useNotesApp } from '@/composables'
import { store } from '@/electron'

const { notesState } = useNotesApp()

const storedLayout = store.app.get('sizes.notesLayout') as number[] | undefined
const defaultLayout = storedLayout || [15, 20, 65]

function onLayout(layout: number[]) {
  store.app.set('sizes.notesLayout', layout)
}
</script>

<template>
  <Resizable.ResizablePanelGroup
    direction="horizontal"
    class="h-screen"
    @layout="onLayout"
  >
    <Resizable.ResizablePanel
      :default-size="defaultLayout[0]"
      :min-size="10"
    >
      <NotesSidebar />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayout[1]"
      :min-size="10"
    >
      <NotesList />
    </Resizable.ResizablePanel>
    <Resizable.ResizableHandle />
    <Resizable.ResizablePanel
      :default-size="defaultLayout[2]"
      :min-size="30"
    >
      <NotesEditorPane />
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
</template>
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/renderer/components/notes-space-layout/`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/notes-space-layout/
git commit -m "feat(notes): add 3-column notes space layout"
```

---

### Task 18: Notes sidebar (library + folders)

**Files:**
- Create: `src/renderer/components/notes-sidebar/NotesSidebar.vue`
- Create: `src/renderer/components/notes-sidebar/NotesSidebarLibrary.vue`
- Create: `src/renderer/components/notes-sidebar/NotesSidebarFolders.vue`
- Create: `src/renderer/components/notes-sidebar/NotesSidebarFolder.vue`

- [ ] **Step 1: Create NotesSidebar.vue**

Follows `Sidebar.vue` pattern. Contains library filters section and folders tree section.

- [ ] **Step 2: Create NotesSidebarLibrary.vue**

Library filters: All Notes, Inbox, Favorites, Trash. Each sets `notesState.libraryFilter`.

- [ ] **Step 3: Create NotesSidebarFolders.vue**

Folder tree with drag-drop reorder, rename, context menu. Follows the existing sidebar folders pattern.

- [ ] **Step 4: Create NotesSidebarFolder.vue**

Single folder tree item with expand/collapse, selection, rename input.

- [ ] **Step 5: Lint**

Run: `pnpm lint src/renderer/components/notes-sidebar/`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/notes-sidebar/
git commit -m "feat(notes): add notes sidebar with library and folder tree"
```

---

### Task 19: Notes list

**Files:**
- Create: `src/renderer/components/notes-list/NotesList.vue`
- Create: `src/renderer/components/notes-list/NotesListHeader.vue`
- Create: `src/renderer/components/notes-list/NotesListItem.vue`

- [ ] **Step 1: Create NotesList.vue**

Follows `SnippetList.vue` pattern. Virtualized list with `RecycleScroller`. Item size ~61px.

- [ ] **Step 2: Create NotesListHeader.vue**

Search input + new note button. Follows `SnippetHeader.vue` pattern.

- [ ] **Step 3: Create NotesListItem.vue**

Note item showing name, folder, date. Selection states, context menu, drag-drop. Follows `SnippetItem.vue` pattern.

- [ ] **Step 4: Lint**

Run: `pnpm lint src/renderer/components/notes-list/`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/notes-list/
git commit -m "feat(notes): add virtualized notes list with search and context menu"
```

---

### Task 20: Notes editor pane

**Files:**
- Create: `src/renderer/components/notes-editor-pane/NotesEditorPane.vue`

- [ ] **Step 1: Create editor pane**

This component wraps the existing `NotesEditor.vue` (CM6 markdown editor) and connects it to the notes composable:

```vue
<script setup lang="ts">
import { useNotes } from '@/composables'

const { selectedNote, updateNoteContent } = useNotes()

const content = computed({
  get: () => selectedNote.value?.content ?? '',
  set: (value: string) => {
    if (selectedNote.value) {
      updateNoteContent(selectedNote.value.id, value)
    }
  },
})
</script>

<template>
  <div
    v-if="selectedNote"
    class="h-full pt-[var(--content-top-offset)]"
  >
    <NotesEditor v-model:content="content" />
  </div>
  <div
    v-else
    class="flex h-full items-center justify-center text-muted-foreground"
  >
    {{ i18n.t('notes.noSelected') }}
  </div>
</template>
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/renderer/components/notes-editor-pane/`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/notes-editor-pane/
git commit -m "feat(notes): add notes editor pane connecting CM6 to composable"
```

---

## Chunk 6: Integration

### Task 21: Storage sync handler

**Files:**
- Modify: `src/renderer/` — find and update the `refreshAfterStorageSync` handler

- [ ] **Step 1: Add 'notes' case to sync handler**

Find the `system:storage-synced` handler (in `system.ts` or wherever `refreshAfterStorageSync` is defined). Add a `'notes'` case that refreshes notes folders + notes + tags:

```typescript
case 'notes':
  await useNoteFolders().getNoteFolders()
  await useNotes().getNotes()
  await useNoteTags().getNoteTags()
  break
```

- [ ] **Step 2: Lint the modified file**

- [ ] **Step 3: Commit**

```bash
git add <modified-file>
git commit -m "feat(notes): add notes case to storage sync handler"
```

---

### Task 22: App initialization for notes space

**Files:**
- Modify: `src/renderer/views/NotesSpace.vue`

- [ ] **Step 1: Add initialization logic**

Update `NotesSpace.vue` to initialize notes data on mount (like `Main.vue` does for code space):

```vue
<script setup lang="ts">
import { useApp, useNoteFolders, useNotes, useNoteTags, useNotesApp } from '@/composables'

const { isAppLoading } = useApp()
const { getNoteFolders } = useNoteFolders()
const { getNotes } = useNotes()
const { getNoteTags } = useNoteTags()
const { restoreNotesState } = useNotesApp()

onMounted(async () => {
  await Promise.all([
    getNoteFolders(),
    getNotes(),
    getNoteTags(),
  ])
  restoreNotesState()
  isAppLoading.value = false
})
</script>

<template>
  <NotesSpaceLayout />
</template>
```

- [ ] **Step 2: Lint**

Run: `pnpm lint src/renderer/views/NotesSpace.vue`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/NotesSpace.vue
git commit -m "feat(notes): add notes space initialization on mount"
```

---

### Task 23: Verify end-to-end

- [ ] **Step 1: Run dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify manually**

1. Click Notes space icon in space rail → 3-column layout renders
2. Create a folder → appears in sidebar tree
3. Create a note → appears in list
4. Type in editor → content persists
5. Move note to trash → disappears from list
6. Switch to Trash filter → see deleted note
7. Switch back to Code space → snippets work unchanged

- [ ] **Step 3: Final lint**

Run: `pnpm lint src/main/storage/providers/markdown/notes/ src/main/api/routes/notes.ts src/main/api/routes/note-folders.ts src/main/api/routes/note-tags.ts src/renderer/composables/notes-space/ src/renderer/components/notes-space-layout/ src/renderer/components/notes-sidebar/ src/renderer/components/notes-list/ src/renderer/components/notes-editor-pane/`

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(notes): final polish and fixes"
```
