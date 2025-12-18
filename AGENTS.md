# massCode AI Coding Guidelines

You are an expert Senior Frontend Developer specializing in Electron, Vue 3, and TypeScript.
Follow these rules strictly when generating code for massCode.

## 1. Core Stack

- **Framework:** Vue 3 (Composition API, `<script setup lang="ts">`)
- **Styling:** TailwindCSS v4 (`@tailwindcss/vite`), `tailwind-merge`, `cva`
- **UI:** Custom components (`src/renderer/components/ui`), Shadcn (based on `radix-vue`), `lucide-vue-next` icons
- **State:** Vue Composables (No Vuex/Pinia)
- **Backend:** Electron (Main), `better-sqlite3` (DB), Elysia.js (API)
- **Utilities:** `@vueuse/core`, `vue-sonner` (Notifications)

## 2. Architecture & Communication

**Strict Separation of Concerns:**

| Layer        | Process  | Access                                      | Communication                             |
|:-------------|:---------|:--------------------------------------------|:------------------------------------------|
| **Renderer** | Frontend | **NO** Node.js/DB access. Only via API/IPC. | Calls API (`api.*`) or IPC (`ipc.invoke`) |
| **API**      | Main     | Full DB/System access.                      | Receives requests from Renderer           |
| **Main**     | Backend  | Full System access.                         | Handles IPC & Lifecycle                   |

**Data Flow:** Renderer → REST API (Elysia) → Service/DB Layer → Response

## 3. Critical Rules & Conventions

### A. Imports (STRICT)

**❌ DO NOT IMPORT:**

- Vue core (`ref`, `computed`, `watch`, `onMounted`) → *Auto-imported*
- Project components (`src/renderer/components/`) → *Auto-imported* (e.g., `<SidebarFolders />` for `components/sidebar/Folders.vue`)

**✅ ALWAYS IMPORT MANUALLY:**

- Shadcn UI: `import * as Select from '@/components/ui/shadcn/select'`
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
- **Channels:** `fs:*`, `system:*`, `db:*`, `main-menu:*`, `prettier:*`.
- **Renderer:** Access Electron only via `src/renderer/electron.ts`.

### E. Localization

- **Primary Language:** English (EN) is the base language. All new keys **MUST** be added to `src/main/i18n/locales/en_US/` first.
- **Strictly No Hardcoding:** Never use hardcoded strings in templates or logic. Always use the localization system.
- **Usage:** Use `i18n.t('namespace:key.path')` in both templates and scripts.
- **Default Namespace:** The `ui` namespace is the default. You can use `i18n.t('key.path')` instead of `i18n.t('ui:key.path')`.
- **Imports:** `import { i18n } from '@/electron'`

## 4. UI/UX Guidelines

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
  - **Missing Elements:** If a required UI element does not exist, create it in `src/renderer/components/ui/` first, following established patterns (Tailwind, cva, cn), then use it.
  - **Naming:** They are auto-imported with a `Ui` prefix (e.g., `<UiButton />`, `<UiInput />`, `<UiCheckbox />`).

## 5. Development Workflow & Commands

**Linting (CRITICAL):**

- **ALWAYS** scope lint commands to specific files/dirs.
- **NEVER** run lint on the whole project during a task.
- Usage: `pnpm lint <path>` or `pnpm lint:fix <path>`

**Other Commands:**

- `pnpm dev`: Start dev server
- `pnpm api:generate`: Regenerate API client (required after API changes)
- `pnpm build`: Build for production

## 6. Code Examples

**Component Setup:**

```html
<script setup lang="ts">
import * as Dialog from '@/components/ui/shadcn/dialog' // Manual import
import { useSnippets } from '@/composables' // Manual import

const { snippets } = useSnippets()
// ref, computed are auto-imported (Vue core)
</script>

<template>
  <div>
    <!-- Use auto-imported UI component -->
    <UiButton>Click me</UiButton>

    <!-- Use Shadcn components with namespace -->
    <Dialog.Dialog>
      <Dialog.DialogTrigger as-child>
        <UiButton variant="outline">Open</UiButton>
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
