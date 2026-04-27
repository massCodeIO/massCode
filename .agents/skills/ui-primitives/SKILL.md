---
name: ui-primitives
description: Use when building or refactoring massCode UI components with local Ui primitives or Shadcn, especially for cn, cva, notifications, and rules against reimplementing basic controls.
---

# UI Primitives

## Overview

Базовые UI-элементы в massCode должны собираться из существующих `Ui*` компонентов и Shadcn-паттернов. Этот skill отвечает за component-level usage rules, а не за общую визуальную базу.

## Component Usage

- Локальные UI-компоненты доступны через auto-import с префиксом `Ui`.
- Базовые элементы вроде button, input, checkbox, action button не переизобретай на сыром HTML, если есть готовый `Ui*` вариант.
- Если нужного элемента нет, сначала создай его в `src/renderer/components/ui/`, потом используй в фиче.

## Buttons

- Primary action должен быть явным и не конкурировать с несколькими равноправными CTA в одном контейнере.
- Icon-only actions должны быть понятны по контексту и иметь tooltip или другой доступный label path.
- Loading и pending actions должны использовать существующий button pattern, а не ad-hoc “disabled text swap”.
- Destructive actions не должны выглядеть как обычные secondary controls.

## Cards And Containers

- Для автономных panel-like блоков используй существующий `Card` / `Ui*` container pattern, если он уже есть в области.
- Внутренние muted blocks не нужно пересобирать разными `div`-паттернами в каждой фиче.
- Repeated panel structure должна переезжать в shared primitive или local feature primitive, а не копироваться markup-в-маркап.

## Readonly And Copyable Content

- Длинный readonly output, generated text, URLs и similar content не показывай как “обычный disabled input”, если это ухудшает чтение.
- Для copy flows используй существующий copy pattern и уведомления через `useSonner()`.
- Readonly content должен оставаться визуально читаемым и удобно копируемым.

## Styling Helpers

- Для variants используй `cva`.
- Для склейки классов используй `cn()`.
- Не делай variants вручную строковыми `if`-цепочками там, где нужен нормальный variant API.

## Shadcn Rules

- Shadcn-компоненты импортируй вручную из `@/components/ui/shadcn/*`.
- Для namespace-based компонентов используй паттерн вроде `import * as Dialog from '@/components/ui/shadcn/dialog'`.

## Notifications

- Для уведомлений используй `useSonner()`.
- Не добавляй локальную, параллельную систему toast/notification внутри фичи.

## Tooltip, Popover, Overlay

- Tooltip — для короткого пояснения.
- Popover — для richer inline content, picker-like content или contextual controls.
- Не заменяй их ad-hoc overlay-разметкой без необходимости.
- Validation и inline guidance должны использовать существующие tooltip/popover primitives, если проект уже их применяет в аналогичных местах.

## Common Mistakes

- Писать ещё одну кнопку или input с нуля “потому что быстрее”.
- Склеивать сложные conditional classes без `cn()`.
- Дублировать существующий primitive внутри feature directory вместо общего `src/renderer/components/ui/`.
- Использовать disabled input как универсальный readonly display surface.
- Делать overlay pattern вручную там, где уже есть Shadcn primitive.
- Смешивать правила primitives с вопросами визуальной базы, которые должны идти в `ui-foundations`.
