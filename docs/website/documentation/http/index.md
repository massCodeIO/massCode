---
title: HTTP Client
description: "Learn the massCode HTTP workspace, send your first request, and build reusable API workflows."
---

# HTTP Client

<AppVersion text=">=5.3" />

The HTTP space is a local API workspace inside massCode. Send HTTP requests, inspect responses, organize collections, and reuse variables alongside your code snippets and notes. No massCode account is required.

This guide describes the **5.11 interface**, including collection settings, scripts, tests, GraphQL, WebSocket, history, and debugging tools. Individual version markers identify features introduced after the original HTTP client.

<img :src="withBase('/http-overview.png')" alt="HTTP workspace with Collections, Environments, Trash, and the Northstar collection overview">

## Getting Started

### Send your first GET request

Postman Echo returns details of the request it receives and requires no API key.

1. Open **HTTP** in the Space rail.
2. Click **+** at the top of the HTTP sidebar, choose **New collection**, name it `API practice`, then use its context menu to create a new request.
3. Name the request `Read an echo`. Keep the method **GET** and enter `https://postman-echo.com/get` in the URL field.
4. In **Params**, add an enabled row named `message` with the value `hello`. The URL and query table stay in sync.
5. Click **Send**, or press <kbd>⌘+Enter</kbd> on macOS / <kbd>Ctrl+Enter</kbd> on Windows and Linux.
6. Select **Response** in the lower panel, then open **Body**. If the panel is hidden, open it with the bottom-panel toggle in the top-right editor header. A successful call returns HTTP `200` and JSON containing `args.message` with the value `hello`.
7. Click **Save** next to Send, or press <kbd>⌘+S</kbd> / <kbd>Ctrl+S</kbd>, to keep the request.

**Send** uses your current draft. Saving is a separate action: changing the request name saves the name automatically, but other content needs **Save**. If you do not receive a response, check internet access and the URL, then use [Debugging](./debugging).

<img :src="withBase('/http-first-request.png')" alt="Public Postman Echo GET request returning args.message with hello">

### Turn it into a repeatable check

In **Assertions**, add `Echo succeeded`, source **Status code**, operator **Equals**, expected value `200`. Add another assertion with source **JSON body**, path `/args/message`, operator **Equals**, expected value `"hello"`. Send again and inspect **Test Results**. Quoting `"hello"` makes it a string; `200` is a number.

Next, create and select an [environment](./environments) with `baseUrl` set to `https://postman-echo.com`, and change the URL to <code v-pre>{{baseUrl}}/get</code>. You can now change the server without editing the request.

Already using another client? Start with [Moving from Postman or Bruno](./importing#moving-from-postman-or-bruno), including the format and compatibility checklist.

## Main Concepts

| Concept | Use it for |
| --- | --- |
| [Collection and folders](./collections) | Group requests and share headers, authentication, variables, scripts, and checks. Selecting a collection or folder opens its own editor. |
| [Request](./requests) | Edit a method, URL, parameters, payload, and request-specific behavior; send the draft or save it for reuse. |
| [Authorization](./authorization) | Choose inherited auth, Bearer, Basic, or an API key. |
| [Environment and Session](./environments) | Select server-specific values, keep secrets locally, and pass temporary values between requests. |
| [Response and history](./responses) | Read current results and inspect saved snapshots of earlier sends. |
| [Tests and extraction](./tests) | Check response values and capture data for the next request without code. |
| [Scripts](./scripts) | Compute variables and write synchronous JavaScript tests with the `mc` API. |
| [Folder Runner](./runner) | Execute a saved collection or folder sequentially with isolated temporary variables. |
| [GraphQL](./graphql) / [WebSocket](./websocket) | Send GraphQL queries and mutations, or exchange WebSocket messages. |
| [Settings](./settings) / [Debugging](./debugging) | Control transport behavior, inspect traffic, manage cookies, and use the terminal. |

## Find your way around

The sidebar has collapsible **Collections**, **Environments**, and **Trash** sections. Use search at the top to find items and the star button to filter favorite requests. In Collections, expand the tree to open a request or select the collection/folder itself to edit its shared configuration. The editor shows the selected item's tabs; request previews and responses occupy the lower panel. The editor header has controls to show/hide the sidebar, lower panel, and Variables inspector. Console and Terminal are available in the debugging dock.

The HTTP command palette actions can create a request, collection, folder, or WebSocket request; import collections; and open environments, settings, Console, Terminal, Cookies, or the runner when applicable.

## Folders

A top-level folder is a collection; nested folders provide another configuration scope. Read [Collections & Folders](./collections) for inheritance, navigation, moving items, favorites, and Trash.

### Emoji and Uploaded Images

<AppVersion text=">=5.9" />

Collection and folder icons support built-in icons, native emoji, and uploaded JPG/PNG images. See [Custom icons](./collections#custom-icons).

## Storage

Requests live as Markdown files under `http` in your vault. Saved collection configuration and regular environments travel with the vault. [Secret values](./environments#secret-variables), script trust, cookies, and local interface preferences stay on the device. Session variables are temporary. Back up your vault as part of your normal massCode backup workflow.

## AI Assistant

Use [AI Assistant](/documentation/ai#analyze-an-http-response-and-add-checks) to analyze the current request and latest response, assess existing checks and review proposed assertions before adding them to the draft.

<script setup>
import { withBase } from 'vitepress'
</script>
