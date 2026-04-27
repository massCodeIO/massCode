---
name: api-and-typing
description: Use when defining or reviewing massCode renderer types that come from generated API clients or DTOs, especially when deciding whether to reuse existing API shapes, derive narrower local types, or introduce a UI-only model.
---

# API And Typing

## Overview

Для massCode API types считаются generated-first. Если данные пришли из `~/renderer/services/api/generated` или соответствуют DTO из `src/main/api/dto`, сначала используй существующие типы и utility typing, а не придумывай новый interface рядом с компонентом.

## Core Rules

- Ручные дубли API response types не пиши.
- Сначала ищи тип в `~/renderer/services/api/generated`.
- Если прямого export нет, выводи нужный shape через `Pick`, `Omit`, indexed access, `Parameters`, `ReturnType`, `Awaited`, `NonNullable`.
- Локальный тип допустим только как UI-only model, form model, derived display model или narrow type после нормального data narrowing.

## Good Uses Of Local Types

- Узкий renderer shape после того, как nullable API data уже очищена в одном месте.
- View-model для dashboard card, graph node, readonly row или editor-side helper, если он не равен transport shape.
- Тип аргумента, выводимый из существующего composable или API method через `Parameters` / `ReturnType`.

## Bad Uses Of Local Types

- Полный дубль `SnippetsResponse`, `NotesDashboardResponse`, `TagsResponse` и других generated types.
- Новый interface “для удобства”, если можно взять одну ветку из existing response type.
- Копирование DTO shape в renderer file, хотя он уже импортируемый.

## Common Mistakes

- Сначала придумать локальный interface, а потом уже искать generated type.
- Смешать transport shape и UI view-model без явного adapter step.
- Тащить глубоко в UI сырые nullable API поля вместо одного нормального normalization place.
