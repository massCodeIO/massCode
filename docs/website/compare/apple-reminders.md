---
title: massCode vs Apple Reminders
description: "An honest comparison between massCode tasks and Apple Reminders. Cross-platform open-source developer workspace vs free Apple-built-in task manager with iCloud sync."
---

# massCode vs Apple Reminders

[Apple Reminders](https://www.apple.com/ios/reminders/) ships free with every Mac, iPhone, iPad, Apple Watch, and Vision Pro. It is the default task manager for most Apple users. massCode is a free, open-source, cross-platform developer workspace where [tasks are notes](/documentation/notes/tasks) — plain Markdown files in a vault on your own disk.

If you are entirely on Apple devices and want a zero-friction default task app, Reminders is the more natural fit. If you work across operating systems, or you want tasks to live as markdown next to your snippets and notes, massCode is the more natural fit.

## At a glance

| | massCode | Apple Reminders |
| --- | --- | --- |
| License | Open source (AGPL v3) | Proprietary, built in to Apple OSes |
| Pricing | Free | Free |
| Data location | Local Markdown Vault on your disk | Local on each device, synced via iCloud |
| Sync | iCloud, Dropbox, Google Drive, Syncthing, Git — your choice | iCloud only |
| Native platforms | macOS, Windows, Linux | macOS, iPadOS, iOS, watchOS, visionOS |
| Web access | No web app | View-only web access at [icloud.com/reminders](https://www.icloud.com/reminders) |
| Windows / Linux native app | Yes | No |
| Task model | Notes with `status`, `priority`, and `due` properties | Reminders with subtasks, sections, tags, smart lists |
| Statuses | Todo, In Progress, Done, Blocked | Open / completed |
| Priority | None, Low, Medium, High | None, Low, Medium, High |
| Due dates and times | Calendar picker (date) | Date and time |
| Location-based reminders | No | Yes |
| Recurring tasks | No | Yes |
| Subtasks | Markdown checklist inside the note body | First-class subtasks |
| Shared lists | No | Yes, via iCloud |
| Voice input | No | Siri |
| Account required | No | Apple ID for iCloud sync |

Sources: Apple's [Reminders user guide](https://support.apple.com/guide/reminders/welcome/mac) and the [iCloud Reminders web app](https://www.icloud.com/reminders).

## Where Apple Reminders fits better

Reminders is a strong choice when the goal is "a task manager that just works on all my Apple devices, for free."

- **You are on Apple devices.** Reminders is preinstalled on macOS, iPadOS, iOS, watchOS, and visionOS with seamless iCloud sync.
- **You want zero setup.** No download, no account creation beyond an Apple ID, no separate app to maintain.
- **You want location-based reminders.** "Remind me when I get home," "Remind me when I leave the office" are first-class.
- **You want time-based notifications.** Reminders fires alerts at the right moment, with snooze and repeat.
- **You want Siri.** Capturing a task by voice is one of Reminders' strongest features.
- **You want shared lists.** Shared family lists, shopping lists, project lists work across iCloud accounts.
- **You want recurring tasks.** Daily, weekly, custom — supported natively.

## Where massCode fits better

massCode is a strong choice when Reminders' Apple-only constraint is a problem, or when the "task" is really a working note that needs a structured status.

- **You work across operating systems.** massCode runs natively on macOS, Windows, and Linux from the same vault. Reminders has no native Windows or Linux app — only view-only web access through iCloud.com.
- **You want plain Markdown files on disk.** Every task is a `.md` file with frontmatter in your [Markdown Vault](/documentation/storage). Reminders data lives in Apple's database and is accessed through Apple's apps.
- **You want one workspace, not five apps.** Tasks share the app with [Code](/documentation/code/library), [Notes](/documentation/notes/), [HTTP](/documentation/http/), [Math](/documentation/math/), [Drawings](/documentation/drawings/), and [Tools](/documentation/tools/).
- **You want sync without Apple.** Point [iCloud, Dropbox, Google Drive, Syncthing, or Git](/documentation/sync) at your vault. iCloud is one option among many, not the only one.
- **You want a richer note body per task.** A massCode task is a full markdown note with code blocks, mermaid, mindmap, internal links — not just a notes field.
- **You want In Progress and Blocked statuses.** Reminders is binary (open / completed); massCode has Todo, In Progress, Done, Blocked.

## Honest trade-offs

- **No mobile app in massCode.** Reminders is on every Apple device; massCode is desktop-only.
- **No reminders or notifications in massCode.** Despite the name, "reminders" — alerts, snooze, location triggers, Siri capture — are not part of massCode.
- **No recurring tasks in massCode.** A task has a single `due` date.
- **No first-class subtasks in massCode.** You can write a markdown checklist inside the body, but those checklist items are not separate task entities.
- **No shared lists.** Reminders has iCloud-shared lists; massCode does not.
- **No voice input.** Siri-style capture does not exist in massCode.

## Who should pick which

- Pick **Apple Reminders** if you are Apple-only and want a free, preinstalled task manager with reminders, recurring tasks, location triggers, Siri, and shared lists.
- Pick **massCode** if you need a cross-platform workspace where tasks are plain markdown next to your snippets and notes, with a richer status model and sync your way.

## Using both

You can keep Reminders for life logistics — groceries, family lists, time-and-location alerts — and use massCode tasks for technical work-in-progress, where the "task" is really a working note with code, links, and context.

[Download massCode](/download/) and try it on a few in-flight work notes.
