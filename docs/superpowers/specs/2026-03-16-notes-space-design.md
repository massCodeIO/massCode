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
- No `contents[]` (fragments) — file body IS the note content
- No `contentId` in counters
- No `defaultLanguage` on folders

### Validation

Reuse from `markdown/runtime/validation.ts`:
- `validateEntryName()` — `INVALID_NAME_CHARS`, reserved names
- `RESERVED_ROOT_NAMES` — `inbox`, `trash`, `__spaces__`
- Filter `.masscode/`, `.meta.yaml` when building folder tree

### Tags

Separate tag set from Code space. Tags stored in `__spaces__/notes/.masscode/state.json` alongside folders and notes index.

## 2. Backend (API + Storage)

### Storage provider

```
src/main/storage/providers/markdown/
  notes/
    runtime/
      constants.ts       # NOTES_ROOT path to __spaces__/notes/
      state.ts           # read/write NotesStateFile, debounce/flush
      sync.ts            # syncFoldersWithDisk, loadNotes, getRuntimeCache
      paths.ts           # buildFolderPathMap for notes root
      notes.ts           # readNoteFromFile, persistNote, buildNoteTargetPath
      types.ts           # NoteRecord, NoteFolderRecord, NotesRuntimeCache
      cache.ts           # noteById, folderById maps
      search.ts          # search by name + content
    storages/
      folders.ts         # NoteFoldersStorage (CRUD)
      notes.ts           # NotesStorage (CRUD)
      tags.ts            # NoteTagsStorage (CRUD)
    index.ts             # notesStorageProvider
```

Reuses directly from `markdown/runtime/`:
- `validation.ts` — `validateEntryName()`, constants
- `parser.ts` — `readFolderMetadata()`, `writeFolderMetadata()`, YAML frontmatter parsing
- `normalizers.ts` — `normalizeFlag()`, timestamps

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
| PATCH | `/notes/:id` | Update (name, description, folderId, isFavorites, isDeleted, content) |
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
| PATCH | `/note-tags/:id` | Update |
| DELETE | `/note-tags/:id` | Delete |

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
```

Pattern identical to `useSnippets`/`useFolders`:
- Reactive state at module level (singleton)
- CRUD via `api.notes.*`, `api.noteFolders.*`, `api.noteTags.*`
- Selection: single, range (Shift), toggle (Cmd/Ctrl)
- Search: filtering via API query parameter
- State persistence: `store.app.get('notesState')` / `store.app.set('notesState', ...)`

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
- If `getActiveSpaceId() === 'notes'` -> refresh folders + notes (same as code space pattern)

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
