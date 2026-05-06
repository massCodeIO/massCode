---
name: documentation-workflow
description: Use when adding or updating massCode documentation, documenting a new feature, changing docs website pages, adding docs assets, updating the VitePress sidebar, or adding README feature mentions.
---

# Documentation Workflow

## Overview

Документация massCode живёт в VitePress сайте в `docs/website/documentation`. README — это общий обзор проекта, а не источник детального описания фич.

## Documentation Surfaces

- Документация фич: `docs/website/documentation/**`
- Sidebar документации: `docs/website/.vitepress/config.mts`
- Assets документации: `docs/website/public/**`
- Overview документации: `docs/website/documentation/index.md`
- Overview проекта: `README.md`

## Core Rules

- Проверяй поведение фичи в коде или существующей документации; не документируй по памяти.
- Используй `rg`, чтобы найти связанные страницы, скриншоты, shortcuts, labels и существующие формулировки.
- Если целевая версия известна, используй именно её. Если версия неизвестна, не придумывай её.
- Пользовательская документация сайта пишется на английском, в стиле существующих docs pages.
- Добавляй или обновляй наиболее конкретную страницу в `docs/website/documentation`.
- Для новых страниц используй frontmatter с `title` и `description`.
- Если фича доступна только с конкретного релиза, добавляй `<AppVersion text=">=x.y" />` ближе к началу страницы.
- Добавляй страницу в `docs/website/.vitepress/config.mts` только если она должна появиться в навигации.
- Ссылайся из `docs/website/documentation/index.md` только на широкие, cross-cutting фичи.
- Пиши короткими task-oriented секциями. Предпочитай пользовательские флоу, а не детали реализации.
- Shortcuts документируй через `<kbd>...</kbd>` и указывай macOS плюс Windows/Linux варианты, если они отличаются.

## Images And Assets Rules

- Картинки для docs клади в `docs/website/public`.
- Ссылайся на картинки через `withBase`, например:
  `<img :src="withBase('/feature.png')">`
- Если страница использует `withBase`, добавь соответствующий script block:
  `import { withBase } from 'vitepress'`
- Используй скриншоты только когда они реально объясняют фичу. Не добавляй декоративные изображения.

## README Rules

- Добавляй README-упоминания только для user-facing фич, которые важны на уровне общего обзора проекта.
- Держи README copy коротким и product-level; подробное использование должно быть в `docs/website/documentation`.
- Не пиши в README, когда фича была добавлена. Version availability должна жить в docs pages или release notes.
- Не ставь новую фичу первой автоматически. Сохраняй текущую информационную архитектуру: сначала основные spaces/features, затем широкие workflow helpers, если пользователь не попросил иначе.

## Validation

- Запускай `git diff --check`.
- Для изменений docs website запускай `pnpm -C docs/website build`.
- Если нужно форматирование, ограничивай его изменёнными файлами и избегай широкого churn в config-файлах.
- Не коммить без явной просьбы пользователя. Для commit или PR загружай `github-workflow`.

## Common Mistakes

- Добавлять README-only документацию для фичи, которой нужна настоящая docs page.
- Забывать VitePress sidebar для новой страницы, которая должна быть в навигации.
- Добавлять version availability в README.
- Документировать shortcuts или поведение без проверки реализации.
- Запускать широкие formatters, которые переписывают существующий стиль docs config.
