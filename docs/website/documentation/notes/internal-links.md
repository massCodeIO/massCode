---
title: Internal Links
description: "Link notes, snippets, and HTTP requests together inside massCode Notes with wiki-style links, hover previews, and back-forward navigation."
---

# Internal Links

<AppVersion text=">=5.1" />

Internal Links let you connect notes, snippets, and HTTP requests with wiki-style links directly inside Notes. Use them to build lightweight documentation, link reference snippets or saved API requests from prose, and move through related material without leaving massCode.

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

massCode resolves internal links by item name. A target can be a note, a snippet, or an HTTP request.

If two notes share the same name, qualify the link with a folder path:

```md
[[Folder/Note]]
[[Parent/Child/Note]]
```

## Creating Links

Start typing `[[` in the Notes editor to open the internal links picker.

- The picker searches notes, snippets, and HTTP requests.
- Results show the item name and its current location.
- Press <kbd>Enter</kbd> to insert the active result.
- Use the arrow keys to move through the list.

The picker inserts the shortest unambiguous form: just the name when it is unique, or a folder path when another item shares the same name.

## Plan Material for Later

Type `[[` followed by a title and choose **Plan Note**, **Plan Snippet**, or **Plan HTTP request**. Use the arrow keys and <kbd>Enter</kbd>, or click the action. The **Plan…** action stays pinned below the search results. Press <kbd>Cmd</kbd>+<kbd>Enter</kbd> on macOS or <kbd>Ctrl</kbd>+<kbd>Enter</kbd> on Windows/Linux to jump directly to **Plan Note**, then press <kbd>Enter</kbd> to insert it. Use the arrow keys to choose another type. <kbd>Tab</kbd> keeps its usual indentation behavior. A placeholder is inserted; no material is created yet. Continue writing your note.

When ready, hold <kbd>Cmd</kbd> on macOS or <kbd>Ctrl</kbd> on Windows/Linux and click the placeholder. massCode creates the material, saves its link in your note, and opens it in the usual Notes, Code, or HTTP space. Fill it in normally, then use **Back** to return to your note through the existing navigation history.

Notes and snippets are created in **Inbox**. HTTP requests are created in the **Inbox** collection, which is created on demand. Names are checked when you activate the placeholder: if the name is taken, a numeric suffix is added, such as `Example 1` or `Example 2`.

Placeholders are stored as Markdown:

```md
[[masscode:planned:note|Authentication guide]]
[[masscode:planned:snippet|Token refresh helper]]
[[masscode:planned:http-request|Refresh access token]]
```

Only the clicked placeholder is replaced. Planned material has no backlinks or export link until it is created. Repeated clicks while creation is in progress do not create another object. If a step fails, an error notification offers a retry when it is safe to continue.

::: warning Reserved link targets
The three exact targets above are reserved for placeholders. Existing links using them change meaning; your notes are not rewritten automatically. To link to an imported or older real material with one of these names, select it in the picker, which writes an explicit ID link.
:::

## Opening Links

Hold <kbd>Cmd</kbd> on macOS or <kbd>Ctrl</kbd> on Windows or Linux, then click the link.

- If the target is a note, massCode opens it in Notes.
- If the target is a snippet, massCode switches to Code and opens the snippet there.
- If the target is an HTTP request, massCode switches to HTTP and opens the request there.

Broken links stay visible, but they appear dimmed and struck through so you can spot missing targets.

## Preview

Hover an internal link while holding <kbd>Cmd</kbd> on macOS or <kbd>Ctrl</kbd> on Windows or Linux to open a preview popup.

- Note links show a text excerpt.
- Snippet links show the first snippet fragment.
- HTTP request links show the method, URL, and description.

This helps you confirm the target before you navigate away from the current note.

## Navigation History

When you follow internal links, massCode keeps a small link navigation history for that session.

- Use the back and forward buttons in the editor header to move through link-based navigation.
- Use <kbd>Cmd+[</kbd> / <kbd>Cmd+]</kbd> on macOS or <kbd>Ctrl+[</kbd> / <kbd>Ctrl+]</kbd> on Windows or Linux.
- The same actions are also available from the **History** menu.

The history is specific to internal-link navigation. If you manually select another note or snippet from the list, that temporary link history is cleared.

## When to Use Internal Links

- Link architecture notes to implementation snippets
- Link API docs to saved HTTP requests
- Connect meeting notes to reference code
- Build personal knowledge-base pages that jump between notes, snippets, and requests
- Keep long-form docs in Notes while linking reusable code examples from Code and API checks from HTTP

<script setup>
import { withBase } from 'vitepress'
</script>
