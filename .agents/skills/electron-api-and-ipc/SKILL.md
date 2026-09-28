---
name: electron-api-and-ipc
description: Use when changing massCode API routes, DTOs, IPC handlers, Electron bridges, or any renderer-to-main communication and storage-access boundaries.
---

# Electron API And IPC

## Overview

Все backend-возможности massCode живут в main process. Renderer получает доступ к данным и системным операциям только через Elysia API или IPC channels.

## Renderer Access Rules

- В renderer для данных используй `import { api } from '~/renderer/services/api'`.
- В renderer для системных операций используй `ipc.invoke('channel:action', payload)`.
- Electron API из renderer доступен только через `src/renderer/electron.ts`.
- Никогда не импортируй storage internals или backend-модули напрямую в renderer.

## New API Endpoints

При добавлении нового endpoint:

1. создай DTO в `src/main/api/dto/`;
2. добавь route в `src/main/api/routes/`;
3. запусти `pnpm api:generate`, чтобы обновить клиент.

Не оставляй API-клиент рассинхронизированным с route/DTO изменениями.

## IPC Conventions

- Для filesystem и system ops используй `ipc.invoke(...)`.
- Каналы должны укладываться в семейства:
  - `fs:*`
  - `system:*`
  - `db:*` — legacy или migration flows, не основной путь для новой функциональности
  - `main-menu:*`
  - `prettier:*`
  - `spaces:*`
  - `theme:*`

## Good Boundaries

- Renderer формирует intent и payload.
- Main/API работает с данными приложения, файловой системой и system APIs.
- Ответ возвращается обратно в renderer в виде DTO или IPC result, а не через shared mutable backend module.

## Common Mistakes

- Тянуть backend-модуль напрямую в renderer ради “удобства”.
- Менять DTO/route без `pnpm api:generate`.
- Добавлять system/file behavior в renderer вместо IPC handler.
- Добавлять новые `db:*` flows там, где задача должна идти через текущую API/IPC модель приложения.
- Создавать ad-hoc каналы, которые не укладываются в существующие channel families.
