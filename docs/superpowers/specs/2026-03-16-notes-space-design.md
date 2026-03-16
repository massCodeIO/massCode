# Notes Space Design Spec

## Overview

Notes Space — новое пространство в massCode для работы с markdown-заметками. Полная аналогия с Code space: 3-колоночный layout (папки, список заметок, редактор), CRUD, теги, избранное, корзина, поиск. Хранение — только Markdown vault engine в `__spaces__/notes/`.

## 1. Storage Structure

### Physical layout in vault

```
__spaces__/notes/
  .masscode/
    state.json          # index: folders[], notes[], tags[], counters
    inbox/              # notes without folder (folderId: null)
      note.md
    trash/              # deleted notes (isDeleted: 1)
      note.md
  Work/
    .meta.yaml          # { id, name, createdAt, updatedAt, icon, orderIndex }
    meeting-notes.md
    Nested Folder/
      .meta.yaml
      deep-note.md
  Personal/
    .meta.yaml
    ideas.md
```

### state.json

```typescript
interface NotesStateFile {
  version: number // 1
  counters: {
    noteId: number
    folderId: number
    tagId: number
  }
  notes: { id: number; filePath: string }[]  // index: id -> relative posix path
  folders: NoteFolderRecord[]
  tags: { id: number; name: string; createdAt: number; updatedAt: number }[]
}

interface NoteFolderRecord {
  id: number
  name: string
  parentId: number | null
  icon: string | null
  isOpen: number           // 0 | 1
  orderIndex: number
  createdAt: number
  updatedAt: number
}
```

### Note file format (.md with YAML frontmatter)

```markdown
---
id: 42
name: "Meeting Notes"
description: "Weekly sync"
folderId: 5
isDeleted: 0
isFavorites: 1
tags: [1, 3]
createdAt: 1710000000
updatedAt: 1710001000
---

# Content here

Regular markdown.
```

**Differences from snippets:**
- No `contents[]` (fragments) — file body IS the note content (single string, no fragment parsing)
- No `contentId` in counters
- No `defaultLanguage` on folders
- Note serialization: frontmatter + raw markdown body (no `## Fragment:` blocks)

### Validation

Reuse from `markdown/runtime/validation.ts`:
- `validateEntryName()` — `INVALID_NAME_CHARS`, reserved names
- Filter `.masscode/`, `.meta.yaml` when building folder tree

**Notes-specific reserved names:** The notes storage defines its own reserved root names list (`inbox`, `trash`) scoped to the `__spaces__/notes/` root. Does NOT reuse `RESERVED_ROOT_NAMES` directly, since the snippets list includes `__spaces__` which is irrelevant inside the notes directory.

### Tags

Separate tag set from Code space. Tags stored in `__spaces__/notes/.masscode/state.json` alongside folders and notes index.

## 2. Backend (API + Storage)

### File watcher integration

The existing vault watcher in `watcher.ts` watches the entire `vaultPath`. The `listMarkdownFiles()` function already skips `__spaces__/`, so note files will NOT be indexed as snippets. However, file changes inside `__spaces__/notes/` will trigger watcher events.

**Solution:** Extend `shouldIgnoreWatchPath()` in `watcher.ts` to ignore paths under `__spaces__/notes/` for snippet sync. The notes storage manages its own sync independently — it does NOT use the snippet watcher. Notes sync is triggered explicitly via API calls (CRUD operations update the runtime cache directly). External changes (e.g. vault sync from another device) trigger `system:storage-synced`, which the renderer handles per-space.

### Paths

Notes storage defines its own `getNotesPaths(vaultPath)` function that computes all paths relative to `__spaces__/notes/`:

```typescript
function getNotesPaths(vaultPath: string): NotesPaths {
  const notesRoot = path.join(vaultPath, SPACES_DIR_NAME, 'notes')
  const metaDirPath = path.join(notesRoot, META_DIR_NAME)
  return {
    notesRoot,
    metaDirPath,
    statePath: path.join(metaDirPath, 'state.json'),
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
  }
}
```

Does NOT reuse `getPaths()` from snippets runtime — has its own function to avoid coupling.

### Runtime cache

Notes storage has its own singleton `notesRuntimeRef` (separate from snippet `runtimeRef`):

```typescript
interface NotesRuntimeCache {
  notes: NoteRecord[]
  noteById: Map<number, NoteRecord>
  folders: NoteFolderRecord[]
  folderById: Map<number, NoteFolderRecord>
  state: NotesStateFile
  paths: NotesPaths
  searchTokenToNoteIds: Map<string, Set<number>>
  searchTokensByNoteId: Map<number, string[]>
  searchNoteTextById: Map<number, string>
}
```

Initialized on first API call or app start. Independent lifecycle from snippet cache.

### Storage provider & contracts

Extend `contracts.ts` with notes-specific interfaces:

```typescript
interface NotesStorage {
  getNotes(query: NotesQueryInput): NoteRecord[]
  getNoteCounts(): { total: number; trash: number }
  createNote(input: NoteCreateInput): { id: number }
  updateNote(id: number, input: NoteUpdateInput): void
  deleteNote(id: number): void
  emptyTrash(): void
  addTag(noteId: number, tagId: number): void
  removeTag(noteId: number, tagId: number): void
}

interface NoteFoldersStorage {
  getFolders(): NoteFolderRecord[]
  getFoldersTree(): NoteFolderTreeItem[]
  createFolder(input: NoteFolderCreateInput): { id: number }
  updateFolder(id: number, input: NoteFolderUpdateInput): void
  deleteFolder(id: number): void
}

interface NoteTagsStorage {
  getTags(): NoteTagRecord[]
  createTag(input: NoteTagCreateInput): { id: number }
  updateTag(id: number, input: NoteTagUpdateInput): void
  deleteTag(id: number): void
}
```

Extend `useStorage()` to return notes storages: `storage.notes`, `storage.noteFolders`, `storage.noteTags`. These are only available when markdown engine is active (notes space is markdown-only).

### Storage provider file structure

```
src/main/storage/providers/markdown/
  notes/
    runtime/
      constants.ts       # getNotesPaths(), notes-specific reserved names
      state.ts           # read/write NotesStateFile, debounce/flush (own pendingWrite)
      sync.ts            # syncFoldersWithDisk, loadNotes, getRuntimeCache
      paths.ts           # buildFolderPathMap for notes root
      notes.ts           # readNoteFromFile, persistNote, buildNoteTargetPath
      types.ts           # NoteRecord, NoteFolderRecord, NotesRuntimeCache, NotesPaths
      cache.ts           # notesRuntimeRef singleton, noteById, folderById maps
      search.ts          # search by name + content
    storages/
      folders.ts         # NoteFoldersStorage (CRUD)
      notes.ts           # NotesStorage (CRUD)
      tags.ts            # NoteTagsStorage (CRUD)
    index.ts             # notesStorageProvider
```

Reuses from `markdown/runtime/` (import directly):
- `validation.ts` — `validateEntryName()`, `INVALID_NAME_CHARS`
- `parser.ts` — `readFolderMetadata()`, `writeFolderMetadata()`, `splitFrontmatter()` (but NOT `parseBodyFragments()` or `serializeSnippet()` — these are snippet-specific)
- `normalizers.ts` — `normalizeFlag()`, timestamps

New note-specific functions (in `notes/runtime/notes.ts`):
- `serializeNote()` — frontmatter + raw markdown body
- `parseNote()` — split frontmatter, body is the content string as-is

### API Routes

```
src/main/api/
  dto/
    notes.ts
    note-folders.ts
    note-tags.ts
  routes/
    notes.ts
    note-folders.ts
    note-tags.ts
```

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notes` | List (query: folderId, tagId, search, isFavorites, isDeleted, isInbox) |
| GET | `/notes/counts` | { total, trash } |
| POST | `/notes` | Create |
| PATCH | `/notes/:id` | Update metadata (name, description, folderId, isFavorites, isDeleted) |
| PATCH | `/notes/:id/content` | Update content (replaces markdown body after frontmatter, debounced persist) |
| DELETE | `/notes/:id` | Permanent delete |
| DELETE | `/notes/trash` | Empty trash |
| POST | `/notes/:id/tags/:tagId` | Add tag |
| DELETE | `/notes/:id/tags/:tagId` | Remove tag |
| GET | `/note-folders` | Flat list |
| GET | `/note-folders/tree` | Tree |
| POST | `/note-folders` | Create |
| PATCH | `/note-folders/:id` | Update |
| DELETE | `/note-folders/:id` | Delete |
| GET | `/note-tags` | List |
| POST | `/note-tags` | Create |
| PATCH | `/note-tags/:id` | Update (rename) |
| DELETE | `/note-tags/:id` | Delete |

`PATCH /notes/:id/content` — separate endpoint for content updates because the editor sends frequent debounced saves. Metadata updates (`PATCH /notes/:id`) are less frequent and trigger different side effects (file rename/move).

After creating routes — `pnpm api:generate` for typed client.

## 3. Frontend (UI + State)

### Routing

```typescript
// router/index.ts
RouterName.notesSpace = 'notesSpace'

{ path: '/notes', name: RouterName.notesSpace, component: NotesSpaceLayout }
```

### Space registration

```typescript
// spaceDefinitions.ts — add 'notes' to SpaceId
{
  id: 'notes',
  label: i18n.t('spaces.notes'),
  tooltip: i18n.t('spaces.notes'),
  icon: Notebook,              // lucide-vue-next
  to: { name: RouterName.notesSpace },
  isActive: (name) => name === RouterName.notesSpace
}
```

### Composables

```
src/renderer/composables/
  notes-space/
    useNotes.ts              # module-level state: notes, selectedNoteIds, searchQuery
    useNoteFolders.ts        # module-level state: folders, selectedFolderIds, renameFolderId
    useNoteTags.ts           # module-level state: tags
    useNotesApp.ts           # state persistence: selectedFolderId, selectedNoteId, libraryFilter
    index.ts                 # re-exports all composables
```

Re-exported from `src/renderer/composables/index.ts`.

Pattern identical to `useSnippets`/`useFolders`:
- Reactive state at module level (singleton)
- CRUD via `api.notes.*`, `api.noteFolders.*`, `api.noteTags.*`
- Selection: single, range (Shift), toggle (Cmd/Ctrl)
- Search: filtering via API query parameter
- State persistence: separate `notesState` object in electron-store — `store.app.get('notesState')` / `store.app.set('notesState', ...)`, containing `{ noteId, folderId, tagId, libraryFilter }`

### Components

```
src/renderer/components/
  notes-space-layout/
    NotesSpaceLayout.vue       # 3-column ResizablePanelGroup
  notes-sidebar/
    NotesSidebar.vue           # folder tree + library (inbox, favorites, all, trash)
    NotesSidebarLibrary.vue    # filters
    NotesSidebarFolders.vue    # folder tree (drag-drop, rename, context menu)
    NotesSidebarFolder.vue     # single tree item
  notes-list/
    NotesList.vue              # virtualized note list
    NotesListItem.vue          # single note in list
  notes-editor/
    NotesEditor.vue            # already exists — CM6 markdown editor
```

Layout persistence: `store.app.set('sizes.notesLayout', [15, 20, 65])`

### Sync

On `system:storage-synced`:
- If `getActiveSpaceId() === 'notes'` -> refresh folders + notes + tags
- Notes runtime cache is reloaded from disk (re-read state.json + note files)
- This handles external vault sync (e.g. from another device)

## 4. Localization & Integration

### Localization keys (en_US)

```yaml
spaces:
  notes: "Notes"

notes:
  untitledNote: "Untitled Note"
  untitledFolder: "Untitled Folder"
  newNote: "New Note"
  newFolder: "New Folder"
  deleteNote: "Delete Note"
  deleteFolder: "Delete Folder"
  emptyTrash: "Empty Trash"
  moveToTrash: "Move to Trash"
  restoreFromTrash: "Restore"

sidebar:
  allNotes: "All Notes"
  inbox: "Inbox"
  favorites: "Favorites"
  trash: "Trash"

search:
  placeholder: "Search notes..."

counts:
  notes: "{count} notes"
  trash: "{count} in trash"
```

### Context menus

- **Folder:** Rename, New Folder, New Note, Delete
- **Note in list:** Rename, Duplicate, Add to Favorites / Remove, Move to Trash
- **Trash:** Restore, Delete Permanently, Empty Trash

### Keyboard shortcuts (within notes space)

- `Cmd+N` — new note
- `Cmd+Shift+N` — new folder
- `Cmd+Delete` — move to trash
- `Cmd+F` — search

### Main menu

Add notes space items to main menu, active when `getActiveSpaceId() === 'notes'`.
