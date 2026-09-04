---
title: HTTP Requests
description: "Create, edit, preview, send, duplicate, and inspect HTTP requests in the massCode HTTP space."
---

# Requests

Requests are the main items in the HTTP space. Each request stores the method, URL, params, headers, body, auth settings, and a markdown description.

::: warning
HTTP requests are stored in your Markdown Vault as plain text. Do not save real passwords, API tokens, private keys, or other secrets in request auth, headers, params, or bodies if your vault is synced, shared, or committed to Git.
:::

## Creating Requests

Create a request from the request list header or from a folder context menu. New requests are created in the selected folder.

Request context menus include actions for:

- duplicate
- delete
- copy request preview
- copy internal link
- reveal in file manager

## Request Editor

The request editor is split into focused tabs:

- **Params** - query parameters sent with the URL
- **Headers** - request headers
- **Body** - JSON, text, form URL encoded, or multipart form data
- **Auth** - none, bearer token, or basic auth. Auth values are stored in the vault as plain text, so keep tokens and passwords in [secret variables](/documentation/http/environments#secret-variables) and reference them here.
- **Description** - markdown notes for the request
- **Tests** - extract response values and define checks for the request

Request fields are saved automatically while you edit. Rules in **Tests** have a separate **Save tests** action; save them before sending the request. Switching requests discards unsaved rule edits.

## Body

Use the body tab to choose the payload format for methods that send data.

- **JSON** and **Text** use a CodeMirror editor.
- **Form URL Encoded** uses key-value rows.
- **Multipart Form Data** supports text and file rows.

## Sending Requests

Send the selected request with one of these methods:

- Click the send button next to the URL field.
- Select **"Editor"** > **"Send Request"** from the menu bar.
- Press <kbd>Cmd+Enter</kbd> on macOS or <kbd>Ctrl+Enter</kbd> on Windows or Linux.

## Preview

The lower panel can show the outgoing request before it is sent.

- **HTTP** preview shows the request line, host, headers, and body.
- **cURL** preview builds a command you can paste into a terminal.
- **fetch** and **axios** generate JavaScript from the current draft, including edits that have not yet been autosaved.

Use the copy button in the preview panel to copy the active preview.

JavaScript previews resolve regular environment variables and mask secret values. Unresolved variables remain as placeholders. The axios snippet assumes that your project has axios installed.

For multipart uploads, JavaScript snippets accept `File` or `Blob` arguments in field order instead of copying local file paths. The browser generates the multipart boundary, so a manually entered `Content-Type` is omitted. Fetch cannot send a body with GET or HEAD; the preview warns you to change the method or remove the body.

## Tests and Extracted Variables

Open **Tests** to configure checks and extract values from an HTTP response. These are declarative rules, not JavaScript scripts.

For a login flow:

1. Add an extraction with the variable name `token`, source **JSON body**, and path `/token`.
2. Add an assertion named `Successful login`, source **Status code**, operator **Equals**, and expected value `200`.
3. Click **Save tests**, then send the request.
4. In another request, use <code v-pre>{{token}}</code> in the bearer token field and send it.

JSON paths use JSON Pointer: `/user/id`, `/items/0/name`, or an empty path for the entire response. Escape `/` in a property name as `~1` and `~` as `~0`. Header names are case-insensitive.

Assertions can check status, a JSON value, a header, or duration in milliseconds. Expected values are JSON scalars: `200`, `true`, `null`, or a quoted string such as `"application/json"`. Comparisons do not convert strings to numbers. **Exists** accepts an existing JSON `null`; extraction requires a non-null value. JSON rules cannot inspect binary, truncated, or invalid JSON responses.

The response panel shows each rule's result without displaying extracted values. A failed check does not hide the HTTP response. A failed extraction removes an earlier session value of the same name, preventing reuse of a stale token.

Extracted variables override environment variables for later requests. Their values stay in memory, are masked in previews and request history, and are never automatically written into environments or the vault. **Clear session**, changing the environment or vault, and closing the app discard them. The original server response remains visible in the response viewer and may itself contain sensitive data.

Rules are stored in a hidden YAML file alongside the HTTP collection, separately from request Markdown. Renaming, moving, duplicating, trashing, and restoring requests retain their rules. Older massCode versions ignore these files and do not execute the rules. If a rules file is unavailable in cloud storage, invalid, or from an unsupported format version, sending and saving rules are blocked until it is available and valid.

## Response Viewer

After a request is sent, the response panel shows:

- status, duration, and response size
- body and headers tabs
- JSON formatting for JSON responses
- copy action for response body and headers

HTTP has its own editor preferences, including line wrapping for request previews, request bodies, and response viewers.
