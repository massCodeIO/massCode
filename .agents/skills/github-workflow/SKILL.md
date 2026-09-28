---
name: github-workflow
description: Use when working with massCode issues, branches, commits, pull requests, or merge preparation in GitHub.
---

# github-workflow

## Issue

Если работа идёт по issue, читать его через `gh`:

```bash
gh issue view <number> -R massCodeIO/massCode
```

Если issue описывает bug, не считай его автоматически подтверждённым.

Сначала:

1. понять ожидаемое поведение;
2. проверить текущее поведение в коде или воспроизвести проблему;
3. подтвердить bug или явно зафиксировать, что он не подтверждается;
4. только после этого переходить к ветке, фиксу и PR.

Если bug не воспроизводится или issue описан неясно:

- не начинать слепую реализацию;
- сначала сообщить, что проблема не подтверждена, и уточнить условия или шаги воспроизведения.

## Branch

Создавай ветку от `main` с префиксом по типу изменения (`feat/`, `fix/`, `chore/`, `refactor/`) и коротким описанием. Если работа идёт по issue — уместно добавить номер в конец.

```bash
git checkout main && git pull
git checkout -b feat/<short-description> main
```

## PR

Заголовок PR — conventional commits:

```text
type: description
```

Перед созданием PR предложи заголовок пользователю на подтверждение.

Если PR закрывает существующий issue, в описании добавляй:

```text
closes #123
```

Перед PR убедись, что релевантные проверки и тесты для затронутой области действительно прогнаны.

Создание:

```bash
gh pr create \
  --base main \
  --head <branch-name> \
  --title "type: description" \
  --body "closes #<issue_number>" \
  --assignee @me
```

Если issue нет — в `--body` кратко опиши суть изменений без служебного AI-хвоста.

После создания PR предложи пользователю смерджить его в `main`:

```bash
gh pr merge <pr_number> -R massCodeIO/massCode --squash --delete-branch
```

После merge синхронизируй локальную ветку:

```bash
git checkout main && git pull
git branch -d <branch-name>
```

## Commit

- Только однострочный заголовок conventional commit.
- Используй подходящий scope для коммитов и PR (`feat(notes):`, 'fix(math):).
- Без тела, без `Co-Authored-By`.
