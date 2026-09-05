---
title: HTTP Client
description: "Use the HTTP space in massCode as a lightweight local-first API client for saved requests, imported collections, environments, previews, and responses."
---

# HTTP Client

<AppVersion text=">=5.3" />

HTTP is the API client space inside massCode. Use it to keep reusable requests next to your snippets and notes, import existing API collections, test endpoints during development, and store small API collections in your local vault.

Access HTTP from the **HTTP** icon in the Space rail. The layout follows the same workspace pattern as Code and Notes: folders on the left, requests in the middle, and the request editor with preview and response panels on the right.

<img :src="withBase('/http.png')">

## When to use HTTP

Use HTTP when you want a lightweight request client without leaving massCode.

- test local or remote API endpoints
- exchange WebSocket messages over local or remote connections
- save repeatable requests by project or service
- import collections from OpenAPI, Postman, or Bruno
- keep request descriptions close to implementation notes
- switch variables between local, staging, and production environments
- check responses with assertions and pass extracted values to subsequent requests
- run a folder of requests sequentially with an isolated set of temporary variables
- copy a request as raw HTTP, cURL, fetch, or axios for debugging and integration

## Getting Started

For an existing collection, start with [Importing Collections](/documentation/http/importing#moving-from-postman-or-bruno) to check supported formats and what needs to be recreated.

For a new API, create a [request](/documentation/http/requests), configure its URL and authentication, and send it. Add an [environment](/documentation/http/environments) for reusable settings, then [checks and extracted variables](/documentation/http/tests) as the workflow grows. Save your requests before running them together with [Folder Runner](/documentation/http/runner).

## Main Concepts

### [Requests](/documentation/http/requests)

Requests store the method, URL, params, headers, body, auth settings, description, assertions, and response extraction rules. **Send** runs the current draft without saving it; **Save** next to Send keeps changes across all tabs. Use <kbd>⌘+S</kbd> on macOS or <kbd>Ctrl+S</kbd> on Windows and Linux to save, and <kbd>⌘+Enter</kbd> / <kbd>Ctrl+Enter</kbd> to send. Changes are not autosaved.

### [Environments](/documentation/http/environments)

Environments store reusable variables for local, staging, and production APIs. Temporary Session variables hold extracted response values and override environment variables with the same name. Use the **Variables inspector** next to Environments to inspect both scopes. Previews mask secrets and Session values; sending uses their real values.

### [Tests & Variables](/documentation/http/tests)

Check response status, JSON values, headers, and duration with declarative assertions. Extract response values into temporary variables to reuse a login token or pass data to the next request.

### [JavaScript Scripts](/documentation/http/scripts)

Use trusted pre-request scripts to prepare requests and post-response scripts to write JavaScript tests. Review and trust code locally before it runs.

### [Folder Runner](/documentation/http/runner)

Run a folder of saved HTTP requests in sequence, adjust the run order, and inspect results for each step. Each run has its own temporary variables and can stop at the first failure or continue through the remaining requests.

### [WebSocket](/documentation/http/websocket)

Connect to WebSocket endpoints with params, headers, and authentication. Send text or JSON messages and inspect the connection's message log.

### [Importing Collections](/documentation/http/importing)

Importing creates HTTP folders, requests, and environments from external collection files. HTTP supports OpenAPI JSON/YAML, Postman Collection v2.1 JSON with optional Postman Environment JSON, and Bruno OpenCollection YAML or ZIP exports.

## Folders

HTTP requests are organized in folders. Selecting a folder shows its requests and selects the first request in that folder. Folders support nesting, drag and drop ordering, inline rename, and custom folder icons.

Right-click a folder and choose **Set Icon** to select a built-in Material or Lucide icon. Choose **Remove Icon** to restore the default folder icon.

### Emoji and Uploaded Images

<AppVersion text=">=5.9" />

The icon picker also supports platform-native emoji and uploaded JPG or PNG images. Uploaded images can be previewed before applying and are cropped from the center and resized to 128×128.

## Storage

HTTP data is stored in your vault under the `http` folder. Requests are markdown files with YAML frontmatter, so they can be backed up and synced together with the rest of your massCode data.

<script setup>
import { withBase } from 'vitepress'
</script>
