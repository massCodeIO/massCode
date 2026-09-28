---
name: development-workflow
description: Use when following massCode repo workflow rules, especially for scoped lint and test commands, or when changes require required follow-up commands like code generation or locale sync.
---

# Development Workflow

## Overview

В massCode workflow rules считаются частью качества изменений. Для локальной задачи команды должны быть точечными, а изменения source-of-truth файлов должны сопровождаться обязательными follow-up шагами.

## Linting Rules

- Всегда запускай lint только по затронутым файлам или директориям.
- Никогда не запускай lint по всему проекту во время локальной задачи.
- Используй scoped commands вроде:
  - `pnpm lint <path>`
  - `pnpm lint:fix <path>`

## Testing Rules

- Всегда запускай тесты только по затронутым файлам или директориям.
- Никогда не запускай весь test suite без явной необходимости.
- Используй scoped commands вроде:
  - `pnpm test <path>`
  - `pnpm test:watch <path>`

## Required Follow-Up Commands

- Изменил API DTO/routes → `pnpm api:generate`
- Изменил locale-файлы → `pnpm i18n:copy`

## Common Mistakes

- Прогонять весь lint/test suite для маленькой точечной правки.
- Менять source-of-truth файлы и забывать generation/sync шаг.
- Запускать “на всякий случай” широкие команды вместо минимального релевантного набора.
