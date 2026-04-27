---
name: architecture-standards
description: Use when working in massCode and you need repo-wide architecture rules, naming conventions, decomposition boundaries, or guidance on which massCode skill to load next.
---

# Architecture Standards

## Overview

Базовый принцип проекта: **YAGNI и простота прежде всего**. Не усложняй код ради гипотетических сценариев, не строй абстракции без повторяющейся потребности и не размывай границы между renderer, API и main.

## Core Rules

- Соблюдай разделение слоёв:
  - Renderer: только UI, composables, вызовы `api.*` и `ipc.invoke(...)`.
  - API: маршруты Elysia, DTO, orchestration и доступ к сервисам и данным приложения.
  - Main: системные интеграции, IPC handlers, lifecycle и слой данных приложения.
- Data flow по умолчанию: Renderer → API / IPC → service / data layer → response.
- Vue-компоненты называй в `PascalCase`.
- TypeScript-файлы называй в `camelCase`.
- Composables именуй с префиксом `use`, а имя файла должно совпадать с экспортируемой функцией.

## YAGNI Guardrails

Признаки overengineering:

- функция страхуется от кейса, которого реально не существует;
- factory или wrapper используется ровно в одном месте и не скрывает состояние;
- abstraction-for-abstraction без повторяющейся боли;
- константы, паттерны и конфигурации придуманы заранее, а не из реальной потребности.

## Component Decomposition

- Если компонент становится больше примерно `300` строк или держит `3+` несвязанных обязанности, дели его.
- Порядок разбиения:
  1. вынеси константы и статические данные;
  2. вынеси чистые функции в utils, только если это реально переиспользуется;
  3. перемести состояние и эффекты в composable;
  4. разбей шаблон на локальные child components.
- Не держи в `<template>` логику сложнее тернарного оператора.

## Feature Subdirectories

- Если часть домена выросла в отдельный subsystem, группируй локальные компоненты, helpers, tests и fixtures в поддиректорию.
- Внутри поддиректории не повторяй полный родительский префикс в именах файлов.
- Локальные файлы держи рядом с фичей. Shared-код, который нужен нескольким областям, оставляй выше уровнем.

## When to Load Other Skills

- Vue renderer, auto-imports, composables, shared state:
  `vue-renderer-standards`
- визуальная база, typography, renderer styling decisions:
  `ui-foundations`
- `Ui*`, Shadcn, `cn`, `cva`, notifications:
  `ui-primitives`
- API routes, DTO, IPC, Electron boundaries:
  `electron-api-and-ipc`
- generated API types, utility typing, локальные view-model:
  `api-and-typing`
- `code` / `notes` / `math` / `tools`, состояние spaces и их синхронизация:
  `spaces-architecture`
- i18n, locale keys, `i18n.t(...)`:
  `i18n`
- scoped lint/test и follow-up commands:
  `development-workflow`

## Common Mistakes

- Тянуть DB или filesystem knowledge в renderer.
- Раздувать один компонент до “оркестратора всего”.
- Выносить абстракцию до появления второй реальной точки использования.
- Размазывать одну фичу по плоской структуре файлов, когда ей уже нужен локальный subdirectory.
- Придумывать локальные typing-паттерны, хотя для них уже пора иметь отдельный skill.
