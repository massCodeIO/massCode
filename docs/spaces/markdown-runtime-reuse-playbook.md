# Markdown Runtime Reuse Playbook

A concise guide for adding new markdown-backed entities without duplicating infrastructure.

---

## 1. Required Shared Primitives

When adding a new markdown entity, you **must** use the following from `runtime/shared/` instead of reimplementing them.

### `shared/path.ts`

| Export | Purpose |
|--------|---------|
| `toPosixPath` | Normalize OS paths to forward-slash form |
| `depthOfRelativePath` | Count directory depth of a relative path |
| `normalizeDirectoryPath` | Ensure trailing slash, posix-normalized |
| `listMarkdownFiles` | Walk a directory and return `.md` file paths |

### `shared/folderIndex.ts`

| Export | Purpose |
|--------|---------|
| `buildFolderPathMap` | Build `folderId → path` lookup from folder list |
| `buildPathToFolderIdMap` | Build `path → folderId` reverse lookup |
| `findFolderByIdPure` | Find a folder in a list by ID (no side effects) |
| `getFolderSiblings` | Return all folders sharing the same parent |
| `getNextFolderOrder` | Compute the next `order` value within a sibling set |

### `shared/searchIndex.ts`

| Export | Purpose |
|--------|---------|
| `normalizeSearchValue` | Lowercase + trim a query string |
| `splitSearchWords` | Tokenize a query into words |
| `createWordTrigrams` | Generate trigram set for a word |
| `buildSearchTokens` | Produce the full token set for an entity field |
| `intersectSets` | Return the intersection of two `Set<string>` objects |

### `shared/stateWriter.ts`

| Export | Purpose |
|--------|---------|
| `scheduleStateFlush` | Debounce a pending write by path key |
| `flushPendingStateWrites` | Immediately flush all pending writes (used on exit) |
| `registerStateWriteHooks` | Register `process` exit/signal hooks once per entity |

---

## 2. File Structure for New Entities

```
entity/
  runtime/
    constants.ts     — entity-specific constants (e.g., file prefix, debounce ms), runtimeRef
    types.ts         — entity-specific runtime types (internal, not API DTOs)
    paths.ts         — thin wrappers over shared/folderIndex, with entity-scoped cache
    search.ts        — entity search built on shared/searchIndex primitives
    state.ts         — entity state persistence using shared/stateWriter
    sync.ts          — disk sync logic (watch + reconcile)
    index.ts         — barrel: re-export everything the routes need
  storages/
    notes.ts / items.ts — CRUD operations for leaf records
    folders.ts          — folder CRUD + tree operations
    tags.ts             — tag CRUD (if applicable)
    index.ts            — factory function returning the full storage object
```

**Rules:**

- `constants.ts` owns the single `runtimeRef` for this entity. Nothing else creates one.
- `paths.ts` **wraps** `buildFolderPathMap` / `buildPathToFolderIdMap`; it does not reimplement them.
- `state.ts` calls `registerStateWriteHooks` exactly once (guard with a module-level boolean).
- `index.ts` in `storages/` exports one factory; route files call that factory, not individual modules.

---

## 3. Minimum Required Tests

Every new entity must ship with the following test files before merging:

| File | What it covers |
|------|---------------|
| `files.test.ts` | `listMarkdownFiles`, path helpers, directory walking edge cases |
| `sync.test.ts` | Full sync cycle: write files to a temp vault, run sync, assert DB state |
| `search.test.ts` | Token building, trigram matching, multi-word intersection |
| `storages/*.test.ts` | CRUD contract: create, read, update, delete, conflict, not-found |

Tests must use a real temp directory (not mocks) for sync and file-walker tests.

---

## 4. API Contract Checklist

Before shipping a route, verify every case:

| Scenario | Expected response |
|----------|------------------|
| PATCH with empty body | `{ invalidInput: true, notFound: false }` |
| GET / PATCH / DELETE with missing ID | `{ notFound: true }` or throw `NotFoundError` |
| Create/rename with a name that already exists in the same parent | `throwStorageError('NAME_CONFLICT')` |
| Create with a `folderId` that does not exist | `throwStorageError('FOLDER_NOT_FOUND')` |

---

## 5. Anti-Patterns

Avoid the following when adding a new entity:

- **Copying helpers** — never copy `search`, `state`, or `path` helpers into the new entity's directory. Import from `shared/`.
- **Premature abstraction** — do not introduce a new shared utility until it has a second real, distinct consumer.
- **Silent fallback on bad input** — e.g., resolving an unknown `folderId` to `null` and continuing silently. Throw `FOLDER_NOT_FOUND` instead.
- **Skipping exit hooks** — `registerStateWriteHooks` in `state.ts` must be called during entity initialization; omitting it causes data loss on unclean exit.
- **Duplicating `runtimeRef`** — each entity owns exactly one `runtimeRef` declared in its `constants.ts`.
