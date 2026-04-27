# Точка входа для агента massCode

Отвечай всегда на русском.

massCode — это приложение на Electron + Vue 3 + TypeScript с TailwindCSS v4 в renderer, API-маршрутами на Elysia в main process, markdown vault как основным хранилищем пользовательского контента в v5 и `store.app` / `store.preferences` для локального UI state и настроек.

## Всегда действующие правила

- Следуй YAGNI. Предпочитай минимальную корректную реализацию вместо спекулятивных абстракций.
- Соблюдай границы слоёв: renderer не должен напрямую обращаться к Node.js, filesystem или DB. Используй API или IPC.
- Никогда не хардкодь пользовательские строки. Используй систему локализации.
- Не запускай lint или тесты по всему проекту для локальной задачи. Ограничивай команды затронутыми файлами или директориями.
- После изменений API DTO или routes запускай `pnpm api:generate`.
- После изменений locale-файлов запускай `pnpm i18n:copy`.
- Если задача совпадает по теме с одним из skills ниже, загружай этот skill до внесения изменений.

## Skills

- `.agents/skills/architecture-standards/SKILL.md`
  Используй первым для общих правил репозитория: архитектура, naming, декомпозиция и выбор следующего skill.
- `.agents/skills/vue-renderer-standards/SKILL.md`
  Используй для работы с Vue renderer: `<script setup lang="ts">`, правила auto-import, composables, shared state и renderer-side паттерны.
- `.agents/skills/ui-foundations/SKILL.md`
  Используй для базовых UI-правил: Tailwind v4, typography через `UiText` и согласованных styling decisions для renderer UI.
- `.agents/skills/ui-primitives/SKILL.md`
  Используй для component-level UI работы: `Ui*` components, Shadcn imports, `cn`, `cva`, notifications и правил против переизобретения primitives.
- `.agents/skills/electron-api-and-ipc/SKILL.md`
  Используй для API routes, DTO, IPC handlers, renderer-to-main communication и границ Electron-интеграции.
- `.agents/skills/api-and-typing/SKILL.md`
  Используй для generated API types, DTO-derived renderer typing и решения, когда локальный UI type оправдан, а когда нужно переиспользовать существующие API types.
- `.agents/skills/spaces-architecture/SKILL.md`
  Используй при изменениях, связанных с `code` / `notes` / `math` / `tools`, markdown-space state, sync behavior или `spaces:*` IPC.
- `.agents/skills/i18n/SKILL.md`
  Используй для правил локализации, размещения locale keys, `i18n.t(...)` и требования не хардкодить строки.
- `.agents/skills/development-workflow/SKILL.md`
  Используй для repo-specific workflow rules: scoped lint/test команды и обязательные follow-up шаги после изменений source-of-truth файлов.
- `.agents/skills/github-workflow/SKILL.md`
  Используй для massCode git и GitHub workflow: issue, ветки, commits, PR и подготовки к merge.

## Рекомендуемый порядок загрузки

- Широкая или неочевидная задача: начни с `architecture-standards`, затем загрузи профильный skill.
- Renderer UI задача: `architecture-standards` → `vue-renderer-standards` → `ui-foundations` → `ui-primitives`.
- API / IPC / Electron задача: `architecture-standards` → `electron-api-and-ipc`.
- Generated types / renderer typing задача: `architecture-standards` → `api-and-typing`.
- Spaces задача: `architecture-standards` → `spaces-architecture`.
- Задача про текст и локализацию: `i18n`.
- Workflow-чувствительная задача: `development-workflow`.
- Задача про git / branch / commit / PR: `github-workflow`.

## Основной стек

- Framework: Vue 3, Composition API, `<script setup lang="ts">`
- Styling: TailwindCSS v4, `tailwind-merge`, `cva`
- UI: локальные `src/renderer/components/ui`, Shadcn поверх `reka-ui`, `lucide-vue-next`
- State: composables, без Pinia/Vuex
- Backend: Electron main, Elysia API, markdown vault для контента и `electron-store` для локального состояния приложения
- Utilities: `@vueuse/core`, `vue-sonner`
