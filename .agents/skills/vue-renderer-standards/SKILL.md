---
name: vue-renderer-standards
description: Use when editing massCode renderer code in Vue 3, especially for script setup patterns, import rules, composables, shared state, and renderer-side conventions.
---

# Vue Renderer Standards

## Overview

Renderer в massCode строится на Vue 3 Composition API с `<script setup lang="ts">`. Здесь важны строгие import rules, composable-first state sharing и запрет на прямой доступ к backend-возможностям.

## Component Pattern

- Используй Vue 3 Composition API и `<script setup lang="ts">`.
- Vue core (`ref`, `computed`, `watch`, `onMounted` и подобные) не импортируй вручную: они auto-imported.
- Проектные компоненты из `src/renderer/components/` тоже не импортируй вручную: они auto-imported.
- Локальную логику компонента держи в script, а не в template.

## Manual Imports Only Where Required

Всегда импортируй вручную:

- composables из `@/composables`;
- utils из `@/utils`;
- `@vueuse/core`;
- Electron bridge из `@/electron`;
- Shadcn UI из `@/components/ui/shadcn/*`.

## Shared State

- Глобальное shared state реализуется composables без Pinia/Vuex.
- Reactive state, который должен шариться между компонентами, объявляй на module level, вне экспортируемой функции composable.
- Persistent UI/settings state храни через `store` из `@/electron`:
  - `store.app` для UI state;
  - `store.preferences` для user preferences.

## VueUse First

- Перед написанием нового composable сначала проверь, нет ли подходящего решения в `@vueuse/core`.
- Кастомный composable добавляй только если готового utility реально нет.

## Renderer Boundaries

- Renderer не импортирует storage internals или backend-модули доступа к данным напрямую.
- Renderer не обращается напрямую к Node.js, filesystem или storage runtime.
- Доступ к main process возможен только через `api` или `ipc`.

## Common Mistakes

- Ручной импорт `ref` / `computed` / `watch`.
- Ручной импорт локальных project components.
- Локальный state внутри composable, который должен быть общим между несколькими компонентами.
- Попытка “срезать путь” и импортировать backend-модуль прямо в renderer.
