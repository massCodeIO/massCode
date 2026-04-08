# massCode AI Coding Guidelines

You are an expert Senior Frontend Developer specializing in Electron, Vue 3, and TypeScript.
Follow these rules strictly when generating code for massCode.

## 1. Core Stack

- **Framework:** Vue 3 (Composition API, `<script setup lang="ts">`)
- **Styling:** TailwindCSS v4 (`@tailwindcss/vite`), `tailwind-merge`, `cva`
- **UI:** Custom components (`src/renderer/components/ui`), Shadcn (based on `reka-ui`), `lucide-vue-next` icons
- **State:** Vue Composables (No Vuex/Pinia)
- **Backend:** Electron (Main), `better-sqlite3` (DB), Elysia.js (API)
- **Utilities:** `@vueuse/core`, `vue-sonner` (Notifications)

## 2. Philosophy

**YAGNI — simplicity above all.** Do not overcomplicate code for hypothetical future scenarios. The minimum viable implementation is the correct implementation. Three similar lines of code are better than a premature abstraction.

Signs of overengineering:
- A function guards against a case that will never happen
- A factory used in exactly one place that doesn't encapsulate state
- Abstraction for its own sake (a wrapper around a single line of code)
- Constants or patterns invented in advance without a real need

## 3. Architecture & Communication

**Strict Separation of Concerns:**

| Layer        | Process  | Access                                      | Communication                             |
|:-------------|:---------|:--------------------------------------------|:------------------------------------------|
| **Renderer** | Frontend | **NO** Node.js/DB access. Only via API/IPC. | Calls API (`api.*`) or IPC (`ipc.invoke`) |
| **API**      | Main     | Full DB/System access.                      | Receives requests from Renderer           |
| **Main**     | Backend  | Full System access.                         | Handles IPC & Lifecycle                   |

**Data Flow:** Renderer → REST API (Elysia) → Service/DB Layer → Response

## 4. File Naming

| Type | Convention | Example |
|------|------------|---------|
| Vue components | PascalCase | `Folders.vue`, `CreateDialog.vue` |
| TypeScript files | camelCase | `useSnippets.ts`, `errorMessage.ts` |

Composables get a `use` prefix. The file name matches the exported function name: `useSnippets.ts` → `export function useSnippets()`.

## 5. Critical Rules & Conventions

### A. Imports (STRICT)

**❌ DO NOT IMPORT:**

- Vue core (`ref`, `computed`, `watch`, `onMounted`) → *Auto-imported*
- Project components (`src/renderer/components/`) → *Auto-imported* (e.g., `<SidebarFolders />` for `components/sidebar/Folders.vue`)

**✅ ALWAYS IMPORT MANUALLY:**

- Shadcn UI: `import { Button } from '@/components/ui/shadcn/button'` or `import * as Select from '@/components/ui/shadcn/select'`
- Composables: `import { useApp } from '@/composables'`
- Utils: `import { cn } from '@/utils'`
- VueUse: `import { useClipboard } from '@vueuse/core'`
- Electron IPC/Store: `import { ipc, store } from '@/electron'`

### B. State & Settings

- **Global State:** Composables in `@/composables` (e.g., `useApp`, `useSnippets`) maintain shared state by defining reactive variables **outside** the exported function (module level). This ensures all components access the same state. **No Pinia/Vuex.**
- **Persistent Settings:** Use `store` from '@/electron'.
  - `store.app`: UI state (sizes, visibility)
  - `store.preferences`: User prefs (theme, language)

### C. Database & API

- **Renderer:** **NEVER** import `better-sqlite3`. Use `import { api } from '~/renderer/services/api'`
- **New Endpoints:**
  1. Define DTO in `src/main/api/dto/`
  2. Add route in `src/main/api/routes/`
  3. **Run `pnpm api:generate`** to update client.

### D. System & IPC

- **File System/System Ops:** Use `ipc.invoke('channel:action', data)`.
- **Channels:** `fs:*`, `system:*`, `db:*`, `main-menu:*`, `prettier:*`, `spaces:*`, `theme:*`.
- **Renderer:** Access Electron only via `src/renderer/electron.ts`.

### E. Spaces Architecture

massCode uses a **Spaces** system to organize different functional areas:

| Space | ID | Description |
|-------|----|-------------|
| Code | `code` | Main snippet management (folders, snippets, tags) |
| Notes | `notes` | Notebook with folders, tags, and markdown notes |
| Math | `math` | Math Notebook with calculation sheets |
| Tools | `tools` | Developer utilities (converters, generators) |

**Space Definitions:** `src/renderer/spaceDefinitions.ts` — `SpaceId`, `getSpaceDefinitions()`, `getActiveSpaceId()`.

**Space State Persistence (Markdown Engine):**
- Each space can store its state in `__spaces__/{spaceId}/.state.yaml` inside the vault.
- Runtime utilities: `src/main/storage/providers/markdown/runtime/spaces.ts` — `ensureSpaceDirectory()`, `getSpaceStatePath()`.
- Generic YAML read/write: `src/main/storage/providers/markdown/runtime/spaceState.ts` — `readSpaceState<T>()`, `writeSpaceState()`.
- Space state writes use the same debounce/flush infrastructure as `state.json` (`pendingStateWriteByPath` in `constants.ts`), so they flush automatically on app exit.
- `__spaces__/` directory exists **only in markdown engine**. When engine is `sqlite`, spaces fall back to `electron-store`.

**Space IPC Channels:**
- `spaces:math:read` — read Math Notebook state (auto-migrates from electron-store on first read in markdown mode).
- `spaces:math:write` — persist Math Notebook state.
- Handlers: `src/main/ipc/handlers/spaces.ts`.

**Space-Aware Sync:**
- `system:storage-synced` event dispatches refresh based on `getActiveSpaceId()`:
  - `code` → refresh folders + snippets
  - `notes` → refresh notes + note folders
  - `math` → `reloadFromDisk()` via `useMathNotebook()`
  - `tools` → no-op (no vault data)
- Mutable operations must call `markPersistedStorageMutation()` to prevent sync loops.

### F. Localization

- **Primary Language:** English (EN) is the base language. All new keys **MUST** be added to `src/main/i18n/locales/en_US/` first.
- **Strictly No Hardcoding:** Never use hardcoded strings in templates or logic. Always use the localization system.
- **Usage:** Use `i18n.t('namespace:key.path')` in both templates and scripts.
- **Default Namespace:** The `ui` namespace is the default. You can use `i18n.t('key.path')` instead of `i18n.t('ui:key.path')`.
- **Imports:** `import { i18n } from '@/electron'`
- **After adding/changing locales:** Run `pnpm i18n:copy` to sync locale files.

## 6. UI/UX Guidelines

- **Variants:** Use `cva` for component variants.
- **Classes:** Use `cn()` to merge Tailwind classes.
- **Notifications:** Use `useSonner()` composable.
- **Utilities / Composables:**
  - **Check `@vueuse/core` first.** Most common logic (clipboard, events, sensors) is already implemented.
  - **Only** create custom composables if no suitable VueUse utility exists.
  - Remember to **manually import** them (e.g., `import { useClipboard } from '@vueuse/core'`).
- **Component Usage (STRICT):**
  - **NEVER** reimplement basic UI elements (buttons, inputs, checkboxes, etc.).
  - **ALWAYS** use existing components from `src/renderer/components/ui/`.
  - **Typography:** Use `UiText` for text rendering by default. Do not hand-roll text styles with `text-*`, `font-*`, or `text-muted-foreground` when an appropriate `UiText` variant fits. If `UiText` lacks a needed size/style, compose it with extra classes instead of replacing it with raw HTML.
  - **Missing Elements:** If a required UI element does not exist, create it in `src/renderer/components/ui/` first, following established patterns (Tailwind, cva, cn), then use it.
  - **Naming:** They are auto-imported with a `Ui` prefix (e.g., `<UiInput />`, `<UiActionButton />`, `<UiText />`).

## 7. Component Decomposition

Split a component when it exceeds ~300 lines or has more than 3 unrelated responsibilities:

1. Extract constants and static data
2. Extract pure functions into utils (only if used in multiple places)
3. Move state and effects into a composable
4. Break the template into child components

Keep no logic in `<template>` more complex than a ternary operator.

**Feature Subdirectories:**

- When a domain area grows into a clear subsystem (for example `notes/dashboard`), group its related components and local helpers into a dedicated subdirectory instead of keeping everything flat in the parent folder.
- This applies not only to `.vue` components, but also to local `ts/js` helpers, tests, fixtures, styles, and other files that belong only to that subsystem.
- Inside such a subdirectory, do **not** repeat the full parent prefix in file names. Prefer `dashboard/Dashboard.vue`, `dashboard/Header.vue`, `dashboard/Section.vue` over `dashboard/NotesDashboardHeader.vue`.
- This project uses component auto-import with directory namespaces, so `notes/dashboard/Dashboard.vue` resolves to `NotesDashboard`, `notes/dashboard/Header.vue` resolves to `NotesDashboardHeader`, etc.
- Keep only files that are truly local to that subsystem in the subdirectory. Shared files used by multiple slices should remain at the higher level or be renamed into a more general shared helper.

## 8. Development Workflow & Commands

**Linting (CRITICAL):**

- **ALWAYS** scope lint commands to specific files/dirs.
- **NEVER** run lint on the whole project during a task.
- Usage: `pnpm lint <path>` or `pnpm lint:fix <path>`

**Testing:**

- **ALWAYS** scope test commands to specific files/dirs when working on a feature.
- **NEVER** run tests on the whole project during a task.
- Usage: `pnpm test <path>` or `pnpm test:watch <path>`

**Other Commands:**

- `pnpm dev`: Start dev server
- `pnpm api:generate`: Regenerate API client (required after API changes)
- `pnpm build`: Build for production

## 9. Code Examples

**Component Setup:**

```html
<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button' // Manual import
import * as Dialog from '@/components/ui/shadcn/dialog' // Manual import
import { useSnippets } from '@/composables' // Manual import

const { snippets } = useSnippets()
// ref, computed are auto-imported (Vue core)
</script>

<template>
  <div>
    <!-- Use Shadcn components -->
    <Dialog.Dialog>
      <Dialog.DialogTrigger as-child>
        <Button variant="outline">Open</Button>
      </Dialog.DialogTrigger>
      <Dialog.DialogContent>
        Snippet count: {{ snippets.length }}
      </Dialog.DialogContent>
    </Dialog.Dialog>
  </div>
</template>
```

**Data Fetching (Renderer):**

```typescript
import { api } from '~/renderer/services/api'
const { data } = await api.snippets.getSnippets({ folderId: 1 })
```

**IPC Call:**

```typescript
import { ipc } from '@/electron'
await ipc.invoke('fs:assets', { buffer, fileName })
```

**Localization:**

```html
<script setup lang="ts">
import { i18n } from '@/electron'
</script>

<template>
  <div>
    <!-- Using default 'ui' namespace -->
    <p>{{ i18n.t('common.save') }}</p>

    <!-- Using specific namespace -->
    <p>{{ i18n.t('messages:snippets.count', { count: 10 }) }}</p>
  </div>
</template>
```

**Creating New API Endpoint (DTO & Route):**

1. **Define DTO** (`src/main/api/dto/snippets.ts`):

   ```typescript
   import { t } from 'elysia'

   // Define validation schema
   const snippetsDuplicate = t.Object({
     id: t.Number()
   })

   // Register in main DTO model
   export const snippetsDTO = new Elysia().model({
     // ... other DTOs
     snippetsDuplicate
   })
   ```

2. **Add Route** (`src/main/api/routes/snippets.ts`):

   ```typescript
   import { useDB } from '../../db'

   app.post('/duplicate', ({ body }) => {
     const db = useDB()
     // Database logic here...
     return { id: newId }
   }, {
     body: 'snippetsDuplicate', // Use registered DTO name
     detail: { tags: ['Snippets'] }
   })
   ```

3. **Generate Client:** Run `pnpm api:generate`
