---
title: Markdown Notes
description: "Write markdown notes in massCode with a Notes Dashboard, live preview, a three-column layout, and features for diagrams, mind maps, and presentations."
---

# Notes

<AppVersion text=">=5.0" />

Notes is the markdown writing space inside massCode. Use it for project documentation, technical notes, drafts, meeting notes, and personal knowledge bases when a snippet is too small and a full note makes more sense.

Access Notes from the **Notes** icon in the Space rail. The layout matches Code: Library on the left, notes list in the middle, editor on the right. You can also open the [Notes Dashboard](/documentation/notes/dashboard) from the grid button in the Notes sidebar to see activity, recent notes, and graph-based navigation before opening a document.

<img :src="withBase('/notes.png')">

## When to use Notes

Use Notes when you want to keep markdown documents close to your snippets and daily workflow.

- write technical documentation and reference material
- keep research notes or project logs
- prepare presentations from markdown
- turn note outlines into mind maps

## Creating a Note

- Select **"File"** > **"New Note"** from the menu bar.
- Press <kbd>Cmd+N</kbd> on macOS or <kbd>Ctrl+N</kbd> on Windows or Linux.

## Dashboard

<AppVersion text=">=5.1" />

Dashboard gives Notes a home screen with a quick overview of your markdown workspace.

- Overview cards for notes, words, folders, and tags
- Activity Heatmap for recent note updates
- Recent Notes and Top Linked Notes lists
- Notes Graph preview with a shortcut to the fullscreen graph
- Widget visibility settings for hiding blocks you do not need

See [Dashboard](/documentation/notes/dashboard) for the full walkthrough.

## Editor Modes

Switch between three editor modes using the controls at the top of the editor.

- **Editor** - raw markdown editing.
- **Live Preview** - split view with source and rendered preview side by side.
- **Preview** - read-only rendered view.

## Editor Features

The editor is built on CodeMirror 6 and includes:

- Syntax highlighting for fenced code blocks
- Smart list indentation with automatic ordered list renumbering
- Tab / Shift-Tab indentation
- Inline markdown formatting shortcuts in editable modes
- Table navigation between cells
- [Internal links](/documentation/notes/internal-links) to notes and snippets
- [Mermaid diagram](/documentation/notes/mermaid) support
- [Image embedding](/documentation/notes/images)
- [Callout blocks](/documentation/notes/callouts)

## Formatting Shortcuts

The following shortcuts work in **Editor** and **Live Preview** modes:

- <kbd>Cmd+B</kbd> / <kbd>Ctrl+B</kbd> for **bold**
- <kbd>Cmd+I</kbd> / <kbd>Ctrl+I</kbd> for *italic*
- <kbd>Cmd+Shift+S</kbd> / <kbd>Ctrl+Shift+S</kbd> for ~~strikethrough~~
- <kbd>Cmd+Shift+H</kbd> / <kbd>Ctrl+Shift+H</kbd> for <span style="background-color: yellow;color:black;padding:1px 2px;">highlight</span>

Press the same shortcut again to remove the markdown markers from the current selection.

## Editor Preferences

Customize the editor appearance and behavior in preferences:

- **Font size** and **font family**
- **Code font family** - separate setting for code blocks
- **Line height** - Compact, Default, or Relaxed
- **Indent size**
- **Limit width** - toggle to constrain the editor width
- **Line numbers** - toggle to show or hide line numbers

<script setup>
import { withBase } from 'vitepress'
</script>
