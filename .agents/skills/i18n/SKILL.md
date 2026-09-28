---
name: i18n
description: Use when changing massCode localization, adding user-facing strings, creating locale keys, or wiring text through the project's translation system.
---

# I18n

## Overview

В massCode новый пользовательский текст всегда проходит через localization system. Базовым source of truth для новых ключей считается английская локаль.

## Localization Rules

- Поддерживаемые локали — `en_US` и `ru_RU`. Базовый язык и fallback — English (`en_US`).
- `en_US` остаётся базовым source of truth для новых ключей.
- Все новые ключи сначала добавляй в `src/main/i18n/locales/en_US/`.
- При добавлении нового ключа сразу добавляй его и в русскую локаль, чтобы `ru_RU` не отставала от базового английского набора.
- При изменении текста под существующим ключом обновляй значения только в `en_US` и `ru_RU`. Удаляй этот ключ из остальных локалей, если он там есть, чтобы использовался английский fallback. Не переводи его на остальные языки и не подставляй туда копию английского текста. Незатронутые ключи сохраняй.
- Новые ключи добавляй только в `en_US` и `ru_RU`; остальные локали используют fallback.
- Не хардкодь user-facing strings ни в template, ни в script logic.
- Используй `i18n.t('namespace:key.path')` или сокращённый `i18n.t('key.path')` для default `ui` namespace.
- Импорт `i18n` делай из `@/electron`.

## After Locale Changes

- После добавления или изменения locale keys запускай `pnpm i18n:copy`.
- Не оставляй `en_US` и `ru_RU` в несинхронном состоянии.
- Остальные локали могут догоняться отдельно контрибьюторами и не считаются обязательным блокером для каждой локальной правки.

## Common Mistakes

- Хардкодить новый текст “временно”.
- Добавлять ключи не в `en_US`, а сразу в другой locale.
- Обновить `en_US`, но забыть сразу добавить тот же ключ в `ru_RU`.
- Использовать текст напрямую в template, хотя это часть UI.
- Забывать `pnpm i18n:copy` после изменения locale source-of-truth.
