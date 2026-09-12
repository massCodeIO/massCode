---
title: Callout Blocks
description: "Highlight notes, important details, and warnings in massCode Notes with Obsidian-style markdown callout blocks."
---

# Callout Blocks

Callout blocks help important information stand out inside a note without leaving markdown. massCode supports Obsidian-style callouts written as blockquotes with a callout marker on the first line.

## Syntax

Start a blockquote with one of the supported markers:

```md
> [!NOTE]
> Use notes for helpful context or background information.

> [!IMPORTANT]
> Use important callouts for details the reader should not miss.

> [!WARNING]
> Use warnings for risks, destructive actions, or anything that needs extra care.
```

Supported callout types are `NOTE`, `IMPORTANT`, `WARNING`, and `TODO`. The marker is case-insensitive, so `> [!note]` works the same as `> [!NOTE]`.

## Multi-line Callouts

Keep each line inside the same blockquote:

```md
> [!IMPORTANT]
> Update the configuration before restarting the app.
>
> Restarting first can leave the workspace in the old state.
```

Callouts are shown with dedicated styling in **Live Preview** and **Preview** modes. In editable modes, the marker stays visible while the cursor is on the callout line, so the markdown remains easy to edit.

## Authoring TODOs and Annotations

Use a TODO callout to mark unfinished work in the current note:

```md
> [!TODO]
> Add an example of error handling.
```

Open **Note inspector → Annotations** to see all callouts in the current note. Filter by type, see occurrence counts, and use the locate button to jump to a callout. The list updates as you edit; deleting a callout removes it from the inspector. These are ordinary Markdown blocks, not separate tasks.
