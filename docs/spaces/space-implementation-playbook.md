# Playbook: Новый Space По Аналогии С Code

Актуально на: 2026-03-18  
Ветка: `feat/notes-editor-cm6-clean`  
Эталон реализации: `Notes Space` (как актуальный пример копирования механики `Code Space`).

## 1. Источник Правды

Если документ расходится с кодом, верим коду.

Ключевые точки для сверки:

- `src/renderer/spaceDefinitions.ts`
- `src/renderer/router/index.ts`
- `src/renderer/components/app-space-shell/AppSpaceShell.vue`
- `src/renderer/ipc/listeners/system.ts`
- `src/main/storage/contracts.ts`
- `src/main/storage/index.ts`
- `src/main/api/index.ts`

## 2. Карта Соответствий Code -> Notes

| Зона | Code Space | Notes Space |
|---|---|---|
| View | `src/renderer/views/Main.vue` | `src/renderer/views/NotesSpace.vue` |
| Layout | `src/renderer/components/code-space-layout/CodeSpaceLayout.vue` | `src/renderer/components/notes-space-layout/NotesSpaceLayout.vue` |
| App state | `src/renderer/composables/useApp.ts` | `src/renderer/composables/notes-space/useNotesApp.ts` |
| Основная сущность | `src/renderer/composables/useSnippets.ts` | `src/renderer/composables/notes-space/useNotes.ts` |
| Папки | `src/renderer/composables/useFolders.ts` | `src/renderer/composables/notes-space/useNoteFolders.ts` |
| Теги | `src/renderer/composables/useTags.ts` | `src/renderer/composables/notes-space/useNoteTags.ts` |
| Sidebar (library/folders/tags) | `src/renderer/components/sidebar/*` | `src/renderer/components/notes-sidebar/*` |
| List | `src/renderer/components/snippet/List.vue` | `src/renderer/components/notes-list/NotesList.vue` |
| Editor pane | `src/renderer/components/editor/*` | `src/renderer/components/notes-editor-pane/*` + `src/renderer/components/notes/NotesEditor.vue` |
| Storage provider (main) | `src/main/storage/providers/markdown/storages/*` | `src/main/storage/providers/markdown/notes/storages/*` |
| Runtime (main) | `src/main/storage/providers/markdown/runtime/*` | `src/main/storage/providers/markdown/notes/runtime/*` |
| API routes | `src/main/api/routes/{snippets,folders,tags}.ts` | `src/main/api/routes/{notes,note-folders,note-tags}.ts` |
| API DTO | `src/main/api/dto/{snippets,folders,tags}.ts` | `src/main/api/dto/{notes,note-folders,note-tags}.ts` |

## 3. Алгоритм Добавления Нового Space

### Шаг 1. Встроить Space в навигацию и роутинг

- Добавить route в `src/renderer/router/index.ts` (`RouterName`, path, component).
- Добавить `SpaceId` и запись в `getSpaceDefinitions()` в `src/renderer/spaceDefinitions.ts`.
- Убедиться, что route считается space-route через `isSpaceRouteName()`, тогда обертка `AppSpaceShell` применится автоматически.

### Шаг 2. Собрать renderer-каркас 1:1 по аналогии

- Создать `View` и `Layout`.
- Разбить UI на три панели как в code/notes: sidebar, list, editor/workspace.
- Создать отдельный namespace composables (как `notes-space/*`) и экспортнуть его через `src/renderer/composables/index.ts`.

### Шаг 3. Реализовать main storage слой

- Добавить контракты в `src/main/storage/contracts.ts`.
- Сделать markdown provider под space (для notes это `src/main/storage/providers/markdown/notes/*`).
- Подключить провайдер в `src/main/storage/index.ts` (по аналогии с `useNotesStorage()`).
- Для state внутри vault использовать `runtime/spaces.ts` и `runtime/spaceState.ts` (если нужен space-local state).

### Шаг 4. Реализовать API слой

- Создать DTO в `src/main/api/dto`.
- Создать routes в `src/main/api/routes`.
- Подключить routes в `src/main/api/index.ts`.
- После изменений API запускать `pnpm api:generate`.

### Шаг 5. Подключить sync и защиту от циклов

- В mutating-операциях вызывать `markPersistedStorageMutation()` в renderer composables.
- В `src/renderer/ipc/listeners/system.ts` добавить refresh ветку для нового space внутри `refreshAfterStorageSync()`.
- Проверить, что при `system:storage-synced` нет loop и нет потери текущего выделения.

### Шаг 6. Выдержать UX parity с Code Space

Обязательные требования (зафиксированы на кейсах Notes):

- Поиск должен корректно работать для строки длиной 1 символ.
- При переключении контекста (папка/тег/library) не должно быть flash пустого состояния.
- Лоадер показывается с задержкой 300 мс, чтобы не мигал на быстрых запросах.
- Инпут тегов должен быть под header редактора (как в code space).
- Панель тегов в sidebar должна быть в том же месте и с тем же поведением, что в code space.

## 4. Чеклист Готовности (DoD)

- [ ] Route + Space rail + `SpaceId` добавлены.
- [ ] Layout и базовые панели собраны.
- [ ] Composables разделены по зонам: app state, entities, folders, tags.
- [ ] Контракты storage добавлены.
- [ ] Markdown storage provider реализован.
- [ ] API DTO + routes подключены.
- [ ] Синхронизация по `system:storage-synced` работает.
- [ ] Все мутации помечают persisted mutation.
- [ ] UX parity-пункты пройдены вручную.
- [ ] Минимальные тесты добавлены в runtime (`*.test.ts`).

## 5. Минимальный Набор Проверок Перед Merge

```bash
# scoped lint только по измененным файлам
pnpm -s eslint <path1> <path2> ...

# runtime-тесты notes (пример)
pnpm test src/main/storage/providers/markdown/notes/runtime/search.test.ts
pnpm test src/main/storage/providers/markdown/notes/runtime/notes.test.ts
pnpm test src/main/storage/providers/markdown/notes/runtime/sync.test.ts
```

## 6. Важно Для Актуальности

- Этот документ intentionally практический: он описывает не «идеальную» архитектуру, а текущий рабочий паттерн в коде.
- При любом рефакторинге `Code Space` или `Notes Space` нужно синхронно обновлять эту карту.
