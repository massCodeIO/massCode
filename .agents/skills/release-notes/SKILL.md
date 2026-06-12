---
name: release-notes
description: Use when generating massCode release notes for a GitHub release. Writes the notes to a gitignored file `docs/releases/<tag>.md` for the user to paste into the GitHub release. Use when summarizing merged PRs of a version into a consistent release notes structure.
---

# Release Notes

## Overview

Этот skill генерирует release notes одного релиза `vX.Y.Z` для вставки в GitHub release. Цель — единая повторяемая структура от релиза к релизу.

Не трогай `docs/website/download/latest-release.md` — это отдельная repo-страница со своим форматом.

## Source Of Truth

- Содержимое выводи из merged PR между предыдущим и новым тегом, не из памяти.
- Список изменений бери так:
  `git log --first-parent --oneline <prev-tag>..<new-tag>` (например `v5.5.0..v5.6.0`).
- Если новый тег ещё не создан, используй `<prev-tag>..HEAD` и спроси/подтверди номер новой версии.
- Поведение значимых фич проверяй в коде или в `docs/website/documentation`, прежде чем формулировать, если оно неочевидно из заголовка PR.

## Output

- Записывай результат в файл `docs/releases/<new-tag>.md` (например `docs/releases/v5.6.0.md`). Папка `docs/releases` в `.gitignore`, это рабочий буфер, а не часть репозитория.
- Пиши именно в файл, а не выводом в терминал: так пользователь копирует чистый markdown без переносов строк, которые добавляет терминал.
- После записи коротко сообщи путь к файлу и при необходимости покажи итог. Не коммить файл.

## Format

Файл содержит один markdown-блок в этой структуре и порядке:

```
## <Feature Name>

<1-2 абзаца: что это и что даёт пользователю.>

## <Another Feature Name>

<1-2 абзаца.>

## Workflow Improvements

- <мелкое улучшение>
- <мелкое улучшение>

## Fixes

- <исправление>
- <исправление>

**Full Changelog**: https://github.com/massCodeIO/massCode/compare/<prev-tag>...<new-tag>
```

Правила структуры:

- Начинай прямо с тематических `##`-разделов. Не добавляй заголовок версии `# vX.Y.Z` (его даёт сам GitHub release), frontmatter или `<AssetsDownload />` — это артефакты repo-страницы.
- Один `##`-раздел на каждую значимую фичу или связную группу фич.
- `## Workflow Improvements` и `## Fixes` включай только если для них есть содержимое.
- Compare-ссылка всегда последней строкой, с актуальными предыдущим и новым тегами.

## What To Include

- User-facing изменения: новые spaces и фичи, заметные улучшения workflow, видимые исправления.
- Крупную фичу выноси в отдельный `##`-раздел с 1-2 абзацами о пользе для пользователя.
- Мелкие улучшения собирай в `## Workflow Improvements` буллетами.
- Исправления собирай в `## Fixes` буллетами, по одному на исправление.

## What To Omit

- Чисто внутренние коммиты: `ci`, `build`, `chore`, рефакторинг, bump зависимостей, релизные служебные коммиты (`build: release vX.Y.Z`).
- Исключение: выноси платформенные изменения, заметные пользователю (например code signing и notarization на macOS), в `## Workflow Improvements`.
- Не описывай детали реализации; пиши о результате для пользователя.

## Writing Style

- Английский, спокойный фактический тон. Что делает фича и зачем она пользователю, без маркетинговых превосходных степеней.
- Никаких em dash. Это общее правило репозитория.
- Имена spaces пиши консистентно: `Code`, `Notes`, `Math Notebook`, `Drawings`, `HTTP`, `Tools`. Не смешивай `Code` и `Snippets` как имя пространства.
- `snippet` — единица контента внутри пространства Code, а не имя пространства. В Fixes допустимо «snippet fences», «snippet sync», но пространство всё равно называется Code.
- Code identifiers, расширения файлов и токены оборачивай в backticks (`` `.excalidraw` ``, `` `@` ``, `` `Esc` ``).
- Shortcuts указывай как в интерфейсе; macOS и Windows/Linux варианты различай, если они отличаются.

## Common Mistakes

- Перечислять коммиты дословно вместо группировки в user-facing разделы.
- Включать `ci` / `build` / `chore` шум, который не виден пользователю.
- Добавлять `# vX.Y.Z`, frontmatter или `<AssetsDownload />` (это формат repo-страницы, а не GitHub release).
- Выводить нотис простыней в терминал вместо файла `docs/releases/<new-tag>.md` (терминал ломает переносы строк при копировании).
- Коммитить файл из `docs/releases` — это игнорируемый рабочий буфер.
- Смешивать имена пространств (`Code` против `Snippets`) внутри одного документа.
- Описывать детали реализации вместо пользы для пользователя.
- Забыть обновить compare-ссылку на актуальные теги.
- Использовать em dash вопреки правилу репозитория.
