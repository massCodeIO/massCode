---
name: spaces-architecture
description: Use when working on massCode spaces such as code, notes, math, or tools, especially when changing their state, behavior, synchronization, or spaces IPC channels.
---

# Spaces Architecture

## Overview

massCode использует систему Spaces для разделения функциональных областей. Это не просто UI tabs: у каждого space есть собственное состояние, свои правила обновления и свой способ синхронизации с данными в vault.

## Space Model

- `code` — snippets, folders, tags
- `notes` — notes, folders, tags, markdown-based flows
- `math` — calculation sheets и состояние math notebook
- `tools` — developer utilities

Основные определения живут в `src/renderer/spaceDefinitions.ts`.

## Space State Storage

- Состояние каждого space хранится в `__spaces__/{spaceId}/.state.yaml` внутри vault.
- Runtime helpers:
  - `src/main/storage/providers/markdown/runtime/spaces.ts`
  - `src/main/storage/providers/markdown/runtime/spaceState.ts`
- Директория `__spaces__/` — служебная часть vault для состояния spaces.

## Persistence Rules

- Запись состояния spaces использует ту же debounce/flush инфраструктуру, что и `state.json`.
- Не ломай совместимость с `pendingStateWriteByPath` и flush-on-exit поведением.
- Если меняешь способ записи, учитывай сценарий завершения приложения до явного ручного flush.

## IPC Rules

- Space-specific IPC handlers живут в `src/main/ipc/handlers/spaces.ts`.
- Текущие math handlers:
  - `spaces:math:read`
  - `spaces:math:write`
- Если добавляется новый `spaces:*` flow, он должен работать через общую модель состояния spaces, а не в обход неё.

## Space-Aware Sync

- `system:storage-synced` обновляет активное пространство через `getActiveSpaceId()`.
- Ожидаемое поведение:
  - `code` → refresh folders + snippets
  - `notes` → refresh notes + note folders
  - `math` → `reloadFromDisk()` через `useMathNotebook()`
  - `tools` → no-op
- Изменения, которые уже сохранены в vault, должны вызывать `markPersistedStorageMutation()`, чтобы не создавать sync loops.

## Common Mistakes

- Считать spaces только UI-концепцией и забывать, что у них есть собственное состояние и правила синхронизации.
- Писать состояние space в обход общих markdown runtime helpers.
- Добавлять mutation без `markPersistedStorageMutation()`.
- Ломать согласованность между состоянием space, helpers и sync behavior.
