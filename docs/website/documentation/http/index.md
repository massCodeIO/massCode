---
title: HTTP Client
description: "Use the HTTP space in massCode as a lightweight local-first API client for saved requests, environments, previews, and responses."
---

# HTTP Client

<AppVersion text=">=5.3" />

HTTP is the API client space inside massCode. Use it to keep reusable requests next to your snippets and notes, test endpoints during development, and store small API collections in your local vault.

Access HTTP from the **HTTP** icon in the Space rail. The layout follows the same workspace pattern as Code and Notes: folders on the left, requests in the middle, and the request editor with preview and response panels on the right.

<img :src="withBase('/http.png')">

## When to use HTTP

Use HTTP when you want a lightweight request client without leaving massCode.

- test local or remote API endpoints
- save repeatable requests by project or service
- keep request descriptions close to implementation notes
- switch variables between local, staging, and production environments
- copy a request as raw HTTP or cURL for debugging and sharing

## Main Concepts

### [Requests](/documentation/http/requests)

Requests store the method, URL, params, headers, body, auth settings, and markdown description for an API call. The editor autosaves changes, shows an outgoing request preview, and sends the selected request with <kbd>Cmd+Enter</kbd> on macOS or <kbd>Ctrl+Enter</kbd> on Windows or Linux.

### [Environments](/documentation/http/environments)

Environments store reusable variables for local, staging, and production APIs. The URL field keeps variables visible while you edit, while preview and request execution resolve values from the active environment.

## Folders

HTTP requests are organized in folders. Selecting a folder shows its requests and selects the first request in that folder. Folders support nesting, drag and drop ordering, inline rename, and custom folder icons.

## Storage

HTTP data is stored in your vault under the `http` folder. Requests are markdown files with YAML frontmatter, so they can be backed up and synced together with the rest of your massCode data.

<script setup>
import { withBase } from 'vitepress'
</script>
