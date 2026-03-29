# Overview

massCode is organized into four spaces, each designed for a specific workflow. Switch between them using the space rail on the left side of the app.

<img :src="withBase('/preview.png')">

## Code

Store and organize code snippets with a three-column layout: library, snippet list, and editor.

## Notes

Write and organize markdown notes. Uses the same three-column layout as Code. Includes live preview, mindmaps, and presentation mode.

## Math

A calculation notebook with a sheets list on the left and a calculator editor on the right. Write expressions in natural language and get instant results.

## Tools

Built-in developer utilities: converters, encoders, generators, and more. Tool categories on the left, tool view on the right.

## General Settings

### Sidebar Toggle

Toggle the sidebar visibility in Code and Notes spaces:

- Select **"View"** > **"Toggle Sidebar"** from the menu bar or press <kbd>Alt+Cmd+B</kbd> on macOS or <kbd>Alt+Ctrl+B</kbd> on Windows or Linux.

### Font Size

Adjust the editor font size in Code and Notes spaces:

- <kbd>Cmd+=</kbd> / <kbd>Ctrl+=</kbd> increase
- <kbd>Cmd+-</kbd> / <kbd>Ctrl+-</kbd> decrease
- <kbd>Cmd+0</kbd> / <kbd>Ctrl+0</kbd> reset to default

### Preferences

- Press <kbd>Cmd+,</kbd> on macOS or <kbd>Ctrl+,</kbd> on Windows or Linux.

### Compact List Mode

Code, Notes, and Math spaces support a compact list mode that reduces the height of items in the lists, allowing you to see more items at once.

<script setup>
import { withBase } from 'vitepress'
</script>
