---
title: Internal Links
description: "Link notes and snippets together inside massCode Notes with wiki-style links, hover previews, and back-forward navigation."
---

# Internal Links

<AppVersion text=">=5.1.0" />

Internal Links let you connect notes and snippets with wiki-style links directly inside Notes. Use them to build lightweight documentation, link reference snippets from prose, and move through related material without leaving massCode.

<img :src="withBase('/notes-internal-links.png')">

## Link Syntax

Use double brackets around the target name:

```md
[[API authentication]]
[[Fetch helper]]
```

You can also provide custom visible text with an alias:

```md
[[API authentication|auth flow]]
[[Fetch helper|request snippet]]
```

massCode resolves internal links by item name. A target can be either a note or a snippet.

## Creating Links

Start typing `[[` in the Notes editor to open the internal links picker.

- The picker searches both notes and snippets.
- Results show the item name and its current location.
- Press <kbd>Enter</kbd> to insert the active result.
- Use the arrow keys to move through the list.

The inserted link keeps the readable wiki-link format in your markdown.

## Opening Links

Hold <kbd>Cmd</kbd> on macOS or <kbd>Ctrl</kbd> on Windows or Linux, then click the link.

- If the target is a note, massCode opens it in Notes.
- If the target is a snippet, massCode switches to Code and opens the snippet there.

Broken links stay visible, but they appear dimmed and struck through so you can spot missing targets.

## Preview

Hover an internal link while holding <kbd>Cmd</kbd> on macOS or <kbd>Ctrl</kbd> on Windows or Linux to open a preview popup.

- Note links show a text excerpt.
- Snippet links show the first snippet fragment.

This helps you confirm the target before you navigate away from the current note.

## Navigation History

When you follow internal links, massCode keeps a small link navigation history for that session.

- Use the back and forward buttons in the editor header to move through link-based navigation.
- Use <kbd>Cmd+[</kbd> / <kbd>Cmd+]</kbd> on macOS or <kbd>Ctrl+[</kbd> / <kbd>Ctrl+]</kbd> on Windows or Linux.
- The same actions are also available from the **History** menu.

The history is specific to internal-link navigation. If you manually select another note or snippet from the list, that temporary link history is cleared.

## When to Use Internal Links

- Link architecture notes to implementation snippets
- Connect meeting notes to reference code
- Build personal knowledge-base pages that jump between notes and snippets
- Keep long-form docs in Notes while linking reusable code examples from Code

<script setup>
import { withBase } from 'vitepress'
</script>
