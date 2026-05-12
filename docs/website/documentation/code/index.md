---
title: Code
description: "Use the Code space in massCode to save, organize, search, edit, preview, and format reusable code snippets."
---

# Code

Code is the snippet library space inside massCode. Use it to keep reusable examples, commands, templates, configuration fragments, and reference code close to your everyday development work.

Access Code from the **Code** icon in the Space rail. The layout has three columns: the [Library](/documentation/code/library) on the left, the snippet list in the middle, and the editor on the right.

<img :src="withBase('/code.png')">

## When to use Code

Use Code when you want a searchable local library for small pieces of reusable code.

- save commands, examples, templates, and configuration snippets
- keep implementation notes next to the code they explain
- organize snippets by project, topic, or language
- store related files or variants inside one snippet
- format supported languages with Prettier
- preview small HTML/CSS ideas or visualize JSON payloads

## Creating a Snippet

- Select **"File"** > **"New Snippet"** from the menu bar.
- Click the **"+"** button next to search in the second column.
- Press <kbd>Cmd+N</kbd> on macOS or <kbd>Ctrl+N</kbd> on Windows or Linux.

The new snippet is created in the currently selected folder, or in **"Inbox"** if no folder is selected.

## Working with Snippets

### Snippets

[Snippets](/documentation/code/snippets) are the main items in Code. Use them for code you reuse across projects, reference examples, terminal commands, configuration files, or short implementation notes.

### Fragments

[Fragments](/documentation/code/fragments) are tabs inside a snippet. Use them when one snippet needs multiple related files, versions, or languages in one place.

### Descriptions

[Descriptions](/documentation/code/description) store usage notes, caveats, links, and extra context next to the snippet.

## Organizing and Finding

### Library

The [Library](/documentation/code/library) gives you system views for Inbox, Favorites, All Snippets, and Trash.

### Folders and Tags

[Folders](/documentation/code/folders) give snippets a primary structure by project, topic, language, or workflow. [Tags](/documentation/code/tags) add another way to group snippets across folders.

Folders can have a default language, so new snippets inside that folder start with the syntax mode you use most often there.

### Search

[Search](/documentation/code/search) finds snippets by title or content across your library when you remember part of the code but not where you saved it.

## Editor Tools

The Code editor is built for editing and reusing snippets:

- Language selection for syntax highlighting
- Copying the whole snippet to the clipboard
- Prettier formatting for supported languages
- HTML and CSS preview for quick experiments
- JSON Visualizer for nested JSON snippets

See [Snippets](/documentation/code/snippets) for the full snippet workflow.

<script setup>
import { withBase } from 'vitepress'
</script>
