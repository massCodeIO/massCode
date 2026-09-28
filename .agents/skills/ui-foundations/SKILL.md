---
name: ui-foundations
description: Use when defining or reviewing massCode UI foundation rules such as typography, renderer styling consistency, TailwindCSS v4 usage, and when raw markup starts competing with established UI text patterns.
---

# UI Foundations

## Overview

UI в massCode должен оставаться визуально консистентным. Этот skill отвечает за базовые styling decisions: как относиться к typography, когда использовать established text patterns и как не скатываться в разрозненный renderer styling.

## Core Rules

- Базовая styling system в renderer строится на TailwindCSS v4.
- Новые UI-экраны и состояния должны продолжать существующий visual language, а не вводить локальные правила “для одного места”.
- Для стандартного app UI предпочитай семантические токены вроде `bg-background`, `text-muted-foreground`, `border-border`, `border-destructive/*` вместо raw palette-классов вроде `bg-white`, `text-black`, `text-green-500`, `bg-slate-900`.
- Typography по умолчанию строится через `UiText`.
- Не заменяй `UiText` на произвольный набор `text-*`, `font-*`, `text-muted-foreground`, если подходящий variant уже существует.
- Если `UiText` почти подходит, лучше добавить точечные классы поверх него, чем уходить в raw typography markup.

## Typography

- `UiText` — базовый источник правды для текстовых размеров и muted-state.
- `caption` и `xs` — подписи, helper text, secondary labels.
- `sm` и `base` — основной интерфейсный текст.
- `lg` и `xl` — усиленные title/value cases, когда это действительно нужно по hierarchy.
- `font-mono` — только для code-like content, IDs, counts with alignment needs, readonly generated output и подобных случаев.
- Для uppercase labels используй существующий pattern через `UiText` или согласованный tracking/uppercase стиль, а не случайную смесь utility classes в каждом месте.

## Spacing And Layout Rhythm

- Корневые screen/container wrappers обычно живут в ритме `space-y-4` или `space-y-6`.
- Внутри компактных секций чаще всего `space-y-2` или `space-y-3`.
- Grid gaps по умолчанию: `gap-2`, `gap-3`, `gap-4` в зависимости от плотности.
- Не придумывай локальный spacing-scale для одного экрана, если существующие интервалы уже покрывают задачу.
- Повторяющиеся content blocks должны иметь одинаковый padding и vertical rhythm.

## Radius And Shadows

- `rounded-md` — controls, inline boxes, compact containers.
- `rounded-lg` — card-like blocks, dialogs, overlays, dashboard sections.
- `rounded-xl` — preview-heavy surfaces и крупные visual blocks.
- `rounded-full` — pills, badges, circular handles.
- `shadow-xs` — inputs, buttons, small controls.
- `shadow-md` и `shadow-lg` — overlays, popovers, previews, где elevation реально нужна.
- Не вводи произвольные `rounded-[...]` и `shadow-[...]`, если стандартные токены уже подходят.

## Exceptions

- Raw colors допустимы, если цвет является частью самих данных или preview:
  color pickers, contrast previews, code/image export backgrounds, diagram or visualizer nodes.
- Если цвет вычисляется из контента или нужен для корректного контраста на пользовательском фоне, raw class или inline style допустимы.
- Исключения не должны становиться поводом тащить raw palette в обычный application chrome.

## When To Prefer This Skill

- Нужно понять, как оформлять текст и подписи в новом UI.
- Есть соблазн писать raw Tailwind typography вместо существующего text pattern.
- В экране начинают появляться локальные styling rules, которые расходятся с остальным renderer UI.
- Нужно принять решение на уровне визуальной базы, а не конкретного button/input/dialog.

## Common Mistakes

- Размазывать локальные визуальные исключения по фичам.
- Тащить raw palette в обычный app UI без реальной причины.
- Писать текст напрямую через произвольные utility classes там, где подходит `UiText`.
- Делать новый экран со своим spacing rhythm вместо существующего scale.
- Случайно смешивать small-control radii и preview-surface radii в одном и том же UI слое.
- Считать Tailwind поводом делать каждый экран визуально “с нуля”.
