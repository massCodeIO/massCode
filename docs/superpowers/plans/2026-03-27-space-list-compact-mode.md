# Space List Compact Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared compact list mode for `code`, `notes`, and `math`, and expose it in the OS `View` menu.

**Architecture:** Persist a shared `compactListMode` boolean in renderer app storage, surface it through the main-menu context, and let each list-based space switch between regular and compact item layouts without changing list behavior. Keep menu availability space-aware so unsupported spaces do not expose the toggle.

**Tech Stack:** Electron, Vue 3 Composition API, TypeScript, Vitest, vue-virtual-scroller, TailwindCSS

---

## Chunk 1: Menu context and toggle wiring

### Task 1: Extend main-menu context types and tests

**Files:**
- Modify: `src/main/types/menu.ts`
- Modify: `src/renderer/ipc/main-menu/context.ts`
- Test: `src/renderer/ipc/main-menu/__tests__/context.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that `createMainMenuContext()` exposes `canToggleCompactMode` and `isCompactMode` for `code`, `notes`, and `math`, and disables them for unsupported spaces.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: FAIL because compact-mode fields do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add the new view-context fields and populate them from the renderer menu-context factory.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/types/menu.ts src/renderer/ipc/main-menu/context.ts src/renderer/ipc/main-menu/__tests__/context.test.ts
git commit -m "test: add compact list mode menu context"
```

### Task 2: Add the View menu checkbox and renderer listener

**Files:**
- Modify: `src/main/menu/main.ts`
- Modify: `src/main/menu/__tests__/main.test.ts`
- Modify: `src/renderer/ipc/listeners/main-menu.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that `View` includes a `menu:view.compactMode` checkbox, that it reflects `isCompactMode`, and that it is omitted when `canToggleCompactMode` is false.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts`
Expected: FAIL because the checkbox item is missing.

- [ ] **Step 3: Write minimal implementation**

Render the new menu item from `createViewMenuItems()` and add a `main-menu:toggle-compact-mode` IPC listener stub that will toggle shared state.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/menu/main.ts src/main/menu/__tests__/main.test.ts src/renderer/ipc/listeners/main-menu.ts
git commit -m "feat: add compact list mode menu toggle"
```

## Chunk 2: Shared compact mode state

### Task 3: Persist a shared compact-list-mode flag

**Files:**
- Modify: `src/renderer/composables/useApp.ts`
- Modify: `src/renderer/composables/spaces/notes/useNotesApp.ts`
- Modify: `src/renderer/composables/math-notebook/useMathNotebook.ts`
- Modify: `src/renderer/ipc/main-menu/context.ts`

- [ ] **Step 1: Write the failing test**

Use the existing menu-context tests to assert that `isCompactMode` reflects persisted state values for supported spaces.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: FAIL because no shared compact-mode state is exposed yet.

- [ ] **Step 3: Write minimal implementation**

Store `compactListMode` in `store.app`, expose it through shared composables, and wire `main-menu:toggle-compact-mode` to flip the flag.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/composables/useApp.ts src/renderer/composables/spaces/notes/useNotesApp.ts src/renderer/composables/math-notebook/useMathNotebook.ts src/renderer/ipc/main-menu/context.ts
git commit -m "feat: persist shared compact list mode"
```

## Chunk 3: List rendering updates

### Task 4: Update code and notes list density

**Files:**
- Modify: `src/renderer/components/snippet/List.vue`
- Modify: `src/renderer/components/snippet/Item.vue`
- Modify: `src/renderer/components/notes/NotesList.vue`
- Modify: `src/renderer/components/notes/NotesListItem.vue`

- [ ] **Step 1: Write the failing test**

If existing component tests are absent, use the menu-context and menu tests as behavior guards, then add the minimal UI implementation directly.

- [ ] **Step 2: Run test to verify current baseline**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS before UI edits.

- [ ] **Step 3: Write minimal implementation**

Switch item height and markup by compact-mode state so title and date render on one row in compact mode.

- [ ] **Step 4: Run test to verify regressions are not introduced**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/snippet/List.vue src/renderer/components/snippet/Item.vue src/renderer/components/notes/NotesList.vue src/renderer/components/notes/NotesListItem.vue
git commit -m "feat: compact code and notes lists"
```

### Task 5: Update math sheet list density

**Files:**
- Modify: `src/renderer/components/math-notebook/SheetList.vue`

- [ ] **Step 1: Write the failing test**

Use existing menu-context and menu tests as protection, since the math sheet list currently has no dedicated component test coverage.

- [ ] **Step 2: Run test to verify current baseline**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS before the math UI edit.

- [ ] **Step 3: Write minimal implementation**

Render the sheet title and date in one row when compact mode is enabled, while preserving rename and selection behavior.

- [ ] **Step 4: Run test to verify regressions are not introduced**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/math-notebook/SheetList.vue
git commit -m "feat: compact math sheet list"
```

## Chunk 4: Verification

### Task 6: Run targeted verification

**Files:**
- Modify: `src/main/menu/main.ts`
- Modify: `src/main/menu/__tests__/main.test.ts`
- Modify: `src/main/types/menu.ts`
- Modify: `src/renderer/ipc/main-menu/context.ts`
- Modify: `src/renderer/ipc/main-menu/__tests__/context.test.ts`
- Modify: `src/renderer/ipc/listeners/main-menu.ts`
- Modify: `src/renderer/composables/useApp.ts`
- Modify: `src/renderer/composables/spaces/notes/useNotesApp.ts`
- Modify: `src/renderer/composables/math-notebook/useMathNotebook.ts`
- Modify: `src/renderer/components/snippet/List.vue`
- Modify: `src/renderer/components/snippet/Item.vue`
- Modify: `src/renderer/components/notes/NotesList.vue`
- Modify: `src/renderer/components/notes/NotesListItem.vue`
- Modify: `src/renderer/components/math-notebook/SheetList.vue`

- [ ] **Step 1: Run tests**

Run: `pnpm vitest src/main/menu/__tests__/main.test.ts src/renderer/ipc/main-menu/__tests__/context.test.ts`
Expected: PASS.

- [ ] **Step 2: Run targeted lint**

Run: `pnpm lint src/main/menu/main.ts src/main/menu/__tests__/main.test.ts src/main/types/menu.ts src/renderer/ipc/main-menu/context.ts src/renderer/ipc/main-menu/__tests__/context.test.ts src/renderer/ipc/listeners/main-menu.ts src/renderer/composables/useApp.ts src/renderer/composables/spaces/notes/useNotesApp.ts src/renderer/composables/math-notebook/useMathNotebook.ts src/renderer/components/snippet/List.vue src/renderer/components/snippet/Item.vue src/renderer/components/notes/NotesList.vue src/renderer/components/notes/NotesListItem.vue src/renderer/components/math-notebook/SheetList.vue`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/menu/main.ts src/main/menu/__tests__/main.test.ts src/main/types/menu.ts src/renderer/ipc/main-menu/context.ts src/renderer/ipc/main-menu/__tests__/context.test.ts src/renderer/ipc/listeners/main-menu.ts src/renderer/composables/useApp.ts src/renderer/composables/spaces/notes/useNotesApp.ts src/renderer/composables/math-notebook/useMathNotebook.ts src/renderer/components/snippet/List.vue src/renderer/components/snippet/Item.vue src/renderer/components/notes/NotesList.vue src/renderer/components/notes/NotesListItem.vue src/renderer/components/math-notebook/SheetList.vue
git commit -m "feat: add shared compact list mode"
```
