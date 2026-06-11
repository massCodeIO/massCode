---
title: massCode vs Things 3
description: "An honest comparison between massCode tasks and Things 3 by Cultured Code. Free cross-platform open-source workspace vs premium Apple-only task manager with one-time per-platform pricing."
---

# massCode vs Things 3

[Things 3](https://culturedcode.com/things/) by Cultured Code is a premium, Apple-only task manager with a polished native UI, free Things Cloud sync, and a one-time purchase per platform. massCode is a free, open-source, cross-platform developer workspace where [tasks are notes](/documentation/notes/tasks) — plain Markdown files in a vault on your own disk.

If you live entirely on Apple devices and want a beautifully designed dedicated task manager, Things 3 is the more natural fit. If you work across macOS, Windows, and Linux, or you want your tasks to live as markdown next to your snippets and notes, massCode is the more natural fit.

## At a glance

| | massCode | Things 3 |
| --- | --- | --- |
| License | Open source (AGPL v3) | Proprietary |
| Pricing | Free | One-time per platform: Mac $49.99, iPad $19.99, iPhone + Watch $9.99, Vision Pro $29.99 |
| Data location | Local Markdown Vault on your disk | Local on each device, synced via Things Cloud |
| Sync | iCloud, Dropbox, Google Drive, Syncthing, Git — your choice | Things Cloud, free with the apps |
| Platforms | macOS, Windows, Linux | macOS, iPadOS, iOS, watchOS, visionOS — Apple only |
| Task model | Notes with `status`, `priority`, and `due` properties | Areas → Projects → To-dos with Headings and Checklists |
| Statuses | Todo, In Progress, Done, Blocked | Open / completed / canceled |
| Priority | None, Low, Medium, High | No numeric priority; uses Today / This Evening / When |
| Due dates | Yes, calendar picker | Yes, plus deadlines |
| Reminders | No | Yes |
| Recurring tasks | No | Yes |
| Subtasks | Markdown checklist inside the note body | Checklist items inside a to-do; structure for grouping via Projects |
| Notes inside a task | Full markdown editor with code, mermaid, mindmap, internal links | Markdown notes field |
| Mobile app | No | Yes |
| Account required | No | A free Things Cloud account is needed for sync |

Sources for Things 3 platform pricing: [App Store listings](https://apps.apple.com/us/app/things-3/id904237743) for Mac, iPad, iPhone, and Vision Pro. Things Cloud sync is free with the apps — see [Cultured Code's pricing page](https://culturedcode.com/things/pricing/) and [Things Cloud support](https://culturedcode.com/things/support/articles/2803586/).

## Where Things 3 fits better

Things 3 is a strong choice when "best-in-class native task manager on Apple devices" is what you want.

- **You are all-in on Apple.** Things runs natively on Mac, iPad, iPhone, Apple Watch, and Vision Pro, with deep integration of widgets, Shortcuts, and system features.
- **You want a polished, opinionated workflow.** Areas, Projects, Today, This Evening, Upcoming, Anytime, and Someday are designed around a specific way of planning. Many users find that opinionated structure is the point.
- **You want a one-time purchase.** No subscription. You pay per platform once and get future updates for free.
- **You want free sync without a third-party account.** Things Cloud is included.
- **You want reminders and recurring tasks.** Both are first-class.

## Where massCode fits better

massCode is a strong choice when Things' Apple-only constraint is a problem, or when you want your tasks to live with your notes and snippets.

- **You work across operating systems.** massCode runs on macOS, Windows, and Linux from the same vault.
- **You want plain Markdown files on disk.** Every task is a `.md` file with frontmatter in your [Markdown Vault](/documentation/storage) — not stored in a proprietary database.
- **You want one workspace, not five apps.** Tasks share the app with [Code](/documentation/code/library), [Notes](/documentation/notes/), [HTTP](/documentation/http/), [Math](/documentation/math/), [Drawings](/documentation/drawings/), and [Tools](/documentation/tools/).
- **You want sync your way.** Point [iCloud, Dropbox, Google Drive, Syncthing, or Git](/documentation/sync) at your vault. No required account, no required cloud.
- **You want free and open source.** AGPL v3 source on [GitHub](https://github.com/massCodeIO/massCode).

## Honest trade-offs

- **No mobile app in massCode.** Things runs on iPhone, iPad, Apple Watch, and Vision Pro; massCode is desktop-only.
- **No reminders or notifications in massCode.** Due dates are surfaced in the list and the **Today** / **Upcoming** views, but the app does not push reminders.
- **No recurring tasks in massCode.** A task has a single `due` date.
- **No first-class subtasks in massCode.** You can write a markdown checklist inside the task body, but those checklist items are not separate task entities.
- **No equivalent of Areas / This Evening / Anytime / Someday.** massCode's task views are simpler: **Tasks**, **Today**, **Upcoming**, **Completed**.
- **No award-winning native polish.** Things wins design awards for a reason; massCode is a developer-utility app, not a productivity flagship.

## Who should pick which

- Pick **Things 3** if you are an Apple-only user who wants a beautifully designed, opinionated task manager with reminders, recurring tasks, and free cloud sync.
- Pick **massCode** if you need a cross-platform, free, open-source workspace, and you want your tasks to live as plain markdown next to your snippets, notes, and HTTP requests.

## Using both

If you already use Things 3 for personal task management, you can keep it. massCode is not designed to replace a dedicated task manager. Use it where the "task" is really a working note — a piece of code, a research thread, a bug investigation, a meeting follow-up — that you want to track with a status, a priority, and a due date.

[Download massCode](/download/) and try it on a few in-flight work notes.
