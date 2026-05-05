# Command Palette — roadmap

## Цель

Сделать Command Palette главным быстрым входом в massCode: открыть нужный item, перейти в space, создать новую сущность, выполнить действие, скопировать данные или сузить поиск без мыши.

Текущая реализация уже закрывает базовый quick open:

- `Cmd/Ctrl+P` открывает palette
- стартовый экран показывает spaces
- поиск открывает snippets, notes и HTTP requests
- `Enter` открывает выбранный result
- во время поиска предыдущие results остаются на месте, loader находится в input

Этот документ описывает дальнейшее развитие фичи по этапам. Каждый этап должен быть самостоятельным PR/коммитом или небольшой группой связанных коммитов.

## Product principles

- Palette должна быть полезной даже с пустым query.
- Обычный поиск не должен требовать знания префиксов или команд.
- Power-user механики (`>`, `#`, `/`, actions, aliases) должны ускорять опыт, но не ломать базовый сценарий.
- Results не должны прыгать, схлопываться или менять active item неожиданно во время pending search.
- `Enter` всегда делает самое ожидаемое действие для выбранного item.
- Secondary actions должны быть доступны с клавиатуры, но не шуметь в основном списке.
- Renderer остаётся только UI/composables слоем: поиск и переходы идут через API/composables, без прямого доступа к storage.

## References

Идеи собраны из сильных реализаций command palette / quick switcher:

- VS Code: Command Palette и Quick Open modes (`Cmd+P`, `>`, `@`, `:`, `?`)
- Obsidian: Quick Switcher, recent notes на пустом query, create fallback
- Raycast: Root Search, frecency ranking, favorites, aliases, Action Panel
- GitHub: scoped command palette и typed prefixes
- Linear: context-aware commands и quick look/preview
- Notion: slash commands как быстрый content/action entrypoint
- PowerToys Command Palette: providers/extensions, fallback commands, detail/form pages

## Milestones

| Milestone | Scope | Пользовательская ценность |
|---|---|---|
| M1 | Root screen: recent, favorites, contextual commands | Palette полезна сразу после открытия |
| M2 | Ranking + usage history | Часто используемые items всплывают выше |
| M3 | Command mode `>` | Palette запускает действия, а не только открывает items |
| M4 | Scoped search prefixes | Быстрый поиск внутри нужного типа данных |
| M5 | Create fallbacks | Search no-results становится точкой создания |
| M6 | Actions panel | Копировать/дублировать/reveal/favorite без открытия item |
| M7 | Preview / Quick Look | Можно проверить item до перехода |
| M8 | Provider refactor | Фича масштабируется без раздувания одного composable |
| M9 | Preferences + polish | Настройки, подсказки, доступность, финальная доводка |

---

## M1 — Root screen: recent, favorites, contextual commands

**Goal:** пустой query должен показывать не только spaces, а реальные быстрые точки продолжения работы.

- [ ] Добавить root-секции:
  - [x] `Recent`
  - [ ] `Favorites`
  - [x] `Spaces`
  - [x] `Commands`
- [x] Сохранять последние открытые items в `store.app`:
  - [x] snippets
  - [x] notes
  - [x] HTTP requests
  - [x] spaces
- [x] Ограничить recent list разумным cap, например 20-30 entries.
- [x] Дедуплицировать recent entries по stable item id.
- [ ] Показывать на root screen 3-5 самых релевантных recent/favorites, чтобы `Actions` и `Spaces` оставались в первом экране.
- [ ] Добавить favorite state для palette items:
  - [ ] хранение favorite ids в `store.app`
  - [ ] отображение favorites на root screen
  - [ ] первичный action для toggle favorite можно отложить до M6
- [x] Добавить первые contextual commands:
  - [x] `New snippet`
  - [x] `New note`
  - [x] `New HTTP request`
  - [x] `Open preferences`
- [x] `New snippet` и `New note` из palette создают item в Inbox, а не в случайно выбранной папке.
- [x] `New HTTP request` из palette создаёт request в корне HTTP, пока у HTTP space нет Library/Inbox.
- [x] Если пользователь находится в конкретном space, поднимать команды этого space выше.
- [x] Не ломать текущую механику no-collapse при pending search.

**Acceptance:**

- [ ] Открытие palette без query показывает useful root screen.
- [ ] После открытия snippet/note/http request он появляется в `Recent`.
- [ ] Повторное открытие palette начинает с первого item, без сохранения старого active selection.
- [ ] Empty root screen не дёргается по высоте.

## Product follow-up — HTTP Library / Inbox

**Goal:** привести HTTP space к тем же базовым navigation concepts, что code и notes, если это совпадает с продуктовой моделью.

- [ ] Спроектировать Library section для HTTP:
  - [ ] `Inbox` / root requests
  - [ ] `All requests`
  - [ ] optional `Favorites`
  - [ ] `Trash`
- [ ] Решить, остаётся ли текущий root без folder полноценным Inbox или нужен отдельный persisted marker.
- [ ] Добавить soft-delete модель для HTTP requests:
  - [ ] `isDeleted` в API/storage contract
  - [ ] move to trash вместо immediate delete
  - [ ] restore request
  - [ ] empty trash
- [ ] Обновить sidebar HTTP, selection state и search/query модель.
- [ ] После появления HTTP Inbox обновить `New HTTP request` в command palette на создание именно в Inbox.

## M2 — Ranking + usage history

**Goal:** results должны сортироваться так, как пользователь ожидает, а не только по порядку API responses.

- [ ] Ввести lightweight usage record:
  - [ ] `id`
  - [ ] `type`
  - [ ] `openedAt`
  - [ ] `openCount`
  - [ ] optional `lastQuery`
- [ ] Записывать usage только после успешного `openResult`.
- [ ] Добавить scoring function для results:
  - [ ] exact title match
  - [ ] title prefix match
  - [ ] fuzzy title match
  - [ ] subtitle/folder/tag/language/url match
  - [ ] recency boost
  - [ ] frequency boost
- [ ] Не перетасовывать visible results во время pending search.
- [ ] Сортировать cross-space results после объединения snippets/notes/http.
- [ ] Добавить deterministic tie-breaker, чтобы список не прыгал между одинаковыми score.
- [ ] Подготовить unit-level тесты для scoring helper, если helper будет вынесен отдельно.

**Acceptance:**

- [ ] Часто открываемый item поднимается выше при похожем fuzzy score.
- [ ] Exact/prefix match всё ещё сильнее usage boost.
- [ ] Во время набора query список не схлопывается и не выбирает случайный нижний item.

## M3 — Command mode `>`

**Goal:** palette должна уметь выполнять действия приложения.

- [ ] Добавить result type `command`.
- [ ] Добавить `CommandPaletteCommand` model:
  - [ ] `id`
  - [ ] `title`
  - [ ] `subtitle`
  - [ ] `icon`
  - [ ] `keywords`
  - [ ] `spaceId?`
  - [ ] `run`
- [ ] Поддержать режим `>`:
  - [ ] query `>` показывает все команды
  - [ ] query `> new` фильтрует команды
  - [ ] `Escape` из `>` режима возвращает root/обычный input
- [ ] Добавить базовые команды:
  - [ ] `New snippet`
  - [ ] `New note`
  - [ ] `New HTTP request`
  - [ ] `New folder`
  - [ ] `Open preferences`
  - [ ] `Toggle sidebar`
  - [ ] `Refresh current space`
- [ ] Для команд показывать shortcuts только если они реально существуют.
- [ ] Контекстные команды текущего space сортировать выше.
- [ ] Добавить `?` или help result с доступными режимами.

**Acceptance:**

- [ ] `> note` находит команду создания note.
- [ ] `Enter` выполняет команду и закрывает palette, если команда не требует продолжения.
- [ ] Команды локализованы через i18n.
- [ ] Команды не смешиваются с content search, если пользователь явно в `>` режиме.

## M4 — Scoped search prefixes

**Goal:** дать быстрый способ сузить поиск без переключения space вручную.

- [ ] Определить минимальный set prefixes:
  - [ ] `code:` или `s:` для snippets
  - [ ] `notes:` или `n:` для notes
  - [ ] `http:` или `h:` для HTTP requests
  - [ ] `#` для tags
  - [ ] `/` для folders
  - [ ] `>` для commands
  - [ ] `?` для help
- [ ] Реализовать parser query mode без тяжёлой grammar-абстракции.
- [ ] Для scoped mode показывать визуальный scope chip в input или group heading.
- [ ] `Backspace` на пустом scoped query должен выходить из scope.
- [ ] `Escape` сначала очищает scope/query, затем закрывает palette.
- [ ] Добавить search providers для folders/tags:
  - [ ] code folders
  - [ ] notes folders
  - [ ] HTTP folders
  - [ ] code/notes tags
- [ ] `Enter` на folder/tag result должен открывать соответствующий space и выбрать folder/tag.

**Acceptance:**

- [ ] `notes: api` ищет только notes.
- [ ] `http: auth` ищет только HTTP requests.
- [ ] `#async` находит tag и позволяет перейти в tag-filtered state.
- [ ] `/typescript` находит folder и открывает нужный space/folder.

## M5 — Create fallbacks

**Goal:** no-results не должен быть тупиком.

- [ ] Для no-results показывать fallback actions:
  - [ ] `Create snippet "query"`
  - [ ] `Create note "query"`
  - [ ] `Create HTTP request "query"`
- [ ] Поддержать `Shift+Enter` как create exact fallback.
- [ ] Если query выглядит как URL, первым fallback должен быть `Create HTTP request from URL`.
- [ ] Если query выглядит как cURL, первым fallback должен быть `Import cURL as HTTP request` (можно оставить disabled/follow-up до импорта cURL).
- [ ] Для scoped query fallback должен соответствовать scope:
  - [ ] `notes: Foo` → create note
  - [ ] `code: Foo` → create snippet
  - [ ] `http: Foo` → create request
- [ ] После создания сразу открыть созданный item.
- [ ] Для похожих matches всё равно дать action `Create exact "query"` ниже результатов.

**Acceptance:**

- [ ] Query без results показывает понятное создание.
- [ ] `Shift+Enter` создаёт item без мыши.
- [ ] URL query создаёт HTTP request с заполненным URL.

## M6 — Actions panel

**Goal:** palette должна позволять делать secondary actions без перехода в item.

- [ ] Добавить actions panel для active result:
  - [ ] открыть через `Cmd/Ctrl+K`
  - [ ] открыть через `Right Arrow`
  - [ ] закрыть через `Left Arrow` / `Escape`
- [ ] Общие actions:
  - [ ] Open
  - [ ] Favorite / Unfavorite
  - [ ] Reveal in sidebar
  - [ ] Copy title
- [ ] Snippet actions:
  - [ ] Copy content
  - [ ] Copy markdown/link reference, если применимо
  - [ ] Duplicate
  - [ ] Move to folder (можно follow-up)
  - [ ] Delete (с confirmation или destructive guard)
- [ ] Note actions:
  - [ ] Copy markdown link
  - [ ] Duplicate
  - [ ] Rename
  - [ ] Delete
- [ ] HTTP actions:
  - [ ] Copy URL
  - [ ] Duplicate request
  - [ ] Send request (если безопасно и понятно)
  - [ ] Reveal folder
- [ ] Space actions:
  - [ ] Open
  - [ ] New item in space
- [ ] Для destructive actions использовать существующие app confirmation patterns.
- [ ] После action понятно решать, закрывать palette или возвращаться к списку.

**Acceptance:**

- [ ] Пользователь может скопировать snippet content из palette без открытия snippet.
- [ ] Favorite можно включить/выключить с клавиатуры.
- [ ] Actions зависят от типа result и не показывают невозможные команды.

## M7 — Preview / Quick Look

**Goal:** пользователь должен понимать, что именно он откроет, не покидая palette.

- [ ] Добавить preview area для active result:
  - [ ] desktop: справа, если достаточно ширины
  - [ ] compact: снизу или hidden
- [ ] Поддержать lazy preview loading с cancellation token.
- [ ] Snippet preview:
  - [ ] language
  - [ ] folder
  - [ ] tags
  - [ ] first lines of content
- [ ] Note preview:
  - [ ] folder
  - [ ] tags
  - [ ] markdown excerpt
- [ ] HTTP preview:
  - [ ] method
  - [ ] URL
  - [ ] headers/query count
  - [ ] description excerpt
- [ ] Folder/tag preview:
  - [ ] item counts
  - [ ] target space
- [ ] Не грузить тяжёлый content для каждого result сразу.
- [ ] Preview не должен менять высоту списка при навигации.

**Acceptance:**

- [ ] Навигация стрелками обновляет preview без лагов.
- [ ] Большие notes/snippets не блокируют ввод.
- [ ] Preview можно отключить/не показывать на узких viewport.

## M8 — Provider refactor

**Goal:** остановить рост одного `useCommandPalette.ts` и подготовить фичу к новым result types.

- [ ] Ввести локальные types в command-palette feature directory:
  - [ ] `CommandPaletteItem`
  - [ ] `CommandPaletteAction`
  - [ ] `CommandPaletteProvider`
  - [ ] `CommandPalettePreview`
  - [ ] `CommandPaletteMode`
- [ ] Перенести feature из одного composable в поддиректорию:
  - [ ] `components/command-palette/`
  - [ ] `composables/command-palette/` или `features/command-palette/` если такой pattern будет принят
- [ ] Выделить providers:
  - [ ] `spacesProvider`
  - [ ] `snippetsProvider`
  - [ ] `notesProvider`
  - [ ] `httpProvider`
  - [ ] `commandsProvider`
  - [ ] `foldersProvider`
  - [ ] `tagsProvider`
- [ ] Каждый provider должен отвечать только за:
  - [ ] root items
  - [ ] search
  - [ ] open/run
  - [ ] actions
  - [ ] preview
- [ ] Shared orchestration остаётся в `useCommandPalette`.
- [ ] Не делать публичный plugin API на этом этапе.
- [ ] Добавить scoped tests для pure helpers:
  - [ ] query parser
  - [ ] ranking
  - [ ] provider result merge

**Acceptance:**

- [ ] Добавление нового result type не требует править большой switch в нескольких местах.
- [ ] `useCommandPalette` остаётся orchestration слоем, а не storage знаний обо всех spaces.
- [ ] Текущий UX не регрессирует.

## M9 — Preferences + polish

**Goal:** довести feature до уровня стабильной power-user механики.

- [ ] Настройки:
  - [ ] shortcut для открытия palette
  - [ ] keep previous query on reopen (default off)
  - [ ] show preview (default on desktop)
  - [ ] include deleted/trash items in search (default off)
  - [ ] root screen sections visibility
  - [ ] reset ranking/frecency
- [ ] Accessibility:
  - [ ] корректные roles/aria для list/results/actions
  - [ ] screen-reader friendly labels
  - [ ] focus trap без конфликтов с editor shortcuts
- [ ] Keyboard behavior:
  - [ ] `Escape` clear query first, close second
  - [ ] `Cmd/Ctrl+Backspace` clear query/scope
  - [ ] `Tab` enters selected scope/folder where applicable
  - [ ] `Cmd/Ctrl+Enter` alternate open action where applicable
- [ ] Visual polish:
  - [ ] stable dimensions for list, preview, actions
  - [ ] no duplicate highlights
  - [ ] no empty labels
  - [ ] no layout collapse during debounce/API search
  - [ ] consistent icons and group headings
- [ ] Telemetry/local diagnostics only if project policy allows it:
  - [ ] count local command usage for ranking only
  - [ ] no external analytics without explicit product decision

**Acceptance:**

- [ ] Palette можно использовать полностью с клавиатуры.
- [ ] Настройки не перегружают первый релиз.
- [ ] Ranking можно сбросить, если он стал неудобным.

---

## Recommended execution order

1. [ ] M1 Root screen
2. [ ] M2 Ranking
3. [ ] M3 Command mode
4. [ ] M5 Create fallbacks
5. [ ] M6 Actions panel
6. [ ] M4 Scoped search prefixes
7. [ ] M7 Preview / Quick Look
8. [ ] M8 Provider refactor
9. [ ] M9 Preferences + polish

Причина такого порядка: сначала дать ежедневную пользу и накопить usage data, затем добавить commands/actions, и только после появления реальной сложности переносить систему на provider model.

## Open decisions

- [ ] Shortcut name: оставить `Cmd/Ctrl+P` как основной или добавить `Cmd/Ctrl+K` как альтернативу?
- [ ] Нужно ли показывать deleted/trash items в search по умолчанию?
- [ ] Где хранить favorites и usage: `store.app` или отдельный preferences namespace?
- [ ] Нужен ли публичный "Copy link to item" формат для snippets/notes/http?
- [ ] Делаем ли preview в первом большом релизе или оставляем как отдельный polish milestone?
- [ ] Должен ли `Tab` входить в scope/folder, как GitHub/Raycast, или это слишком неочевидно для massCode?

## Non-goals for now

- [ ] Внешняя plugin/extension system для palette.
- [ ] AI commands внутри palette.
- [ ] Полнотекстовый indexed search по всему vault через отдельный search engine.
- [ ] Global OS-level launcher вне окна massCode.
- [ ] Slash commands внутри editors (`/`, `@`) — это отдельный план после стабилизации main palette.
