---
title: Documentation Overview
description: "Explore the massCode documentation for code snippets, markdown notes, HTTP requests, math notebook, storage, sync, themes, JSON Diff, and built-in developer tools."
---

# Overview

massCode is a free and open source developer workspace for code snippets, markdown notes, HTTP requests, calculations, and quick developer utilities. Instead of scattering everyday work across an editor, a notes app, an HTTP client, a calculator, and a handful of websites, you keep it in focused Spaces inside one local-first desktop app.

Switch between Spaces using the rail on the left side of the app.

<img :src="withBase('/preview.png')">

## Code

Use Code to build a reusable snippet library across projects and languages. The three-column layout keeps organization, search, and editing in one place: Library on the left, snippet list in the middle, editor on the right.

## Notes

Use Notes for longer markdown documents that do not fit well into snippets: project notes, drafts, technical docs, meeting notes, and personal knowledge bases. It uses the same three-column layout as Code and adds a Notes Dashboard, live preview, a notes graph, mindmaps, and fullscreen presentation mode.

## HTTP

Use HTTP as a lightweight API client inside massCode. Store requests in folders, import collections from OpenAPI, Postman, or Bruno, switch environments, preview the outgoing request as raw HTTP or cURL, send it from the editor, and inspect the response body and headers without leaving your workspace.

## Math

Math is a calculator-style notebook for quick development math without leaving massCode. Use it for currency conversion, unit conversion, date math, finance, and natural-language calculations with instant results on every line.

## Tools

Tools covers the small one-off tasks that usually send you to a browser tab: JSON comparison, encoders, decoders, generators, hash utilities, and text converters. Categories are listed on the left, and the active tool opens on the right.

## General Settings

### Sidebar Toggle

Hide or show the Library sidebar in Code and Notes:

- Select **"View"** > **"Toggle Sidebar"** from the menu bar or press <kbd>Alt+Cmd+B</kbd> on macOS or <kbd>Alt+Ctrl+B</kbd> on Windows or Linux.

### Font Size

Adjust the editor font size in Code and Notes:

- <kbd>Cmd+=</kbd> / <kbd>Ctrl+=</kbd> increase
- <kbd>Cmd+-</kbd> / <kbd>Ctrl+-</kbd> decrease
- <kbd>Cmd+0</kbd> / <kbd>Ctrl+0</kbd> reset to default

### Preferences

Open the main preferences window:

- Press <kbd>Cmd+,</kbd> on macOS or <kbd>Ctrl+,</kbd> on Windows or Linux.

### Compact List Mode

Code, Notes, and Math support a compact list mode that reduces item height, so you can see more folders, notes, snippets, or sheets at once.

<script setup>
import { withBase } from 'vitepress'
</script>
