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
- **Variables** - extract response values into temporary session variables under **Post-response**
- **Assertions** - define declarative checks for the request

Use **Save** in the request header or <kbd>⌘</kbd> + <kbd>S</kbd> on macOS / <kbd>Ctrl</kbd> + <kbd>S</kbd> on Windows and Linux to save request fields, assertions, and variable extraction. Changes are not autosaved. A dot beside Save indicates unsaved edits; saving invalid rules opens the tab containing the first error. Before switching requests or leaving the HTTP space, choose **Save**, **Discard changes**, or **Cancel**. If saving fails partway through, remaining unsaved edits stay in the editor for retry.

**Send** uses the current request fields, assertions, and variable extraction without saving them. Invalid rules are highlighted before sending; unsaved changes remain in the editor after execution.

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
- **fetch** and **axios** generate JavaScript from the current draft, including unsaved edits.

Use the copy button in the preview panel to copy the active preview.

JavaScript previews resolve regular environment variables and mask secret values. Unresolved variables remain as placeholders. The axios snippet assumes that your project has axios installed.

For multipart uploads, JavaScript snippets accept `File` or `Blob` arguments in field order instead of copying local file paths. The browser generates the multipart boundary, so a manually entered `Content-Type` is omitted. Fetch cannot send a body with GET or HEAD; the preview warns you to change the method or remove the body.

## Tests and Extracted Variables

Use **Assertions** for checks and **Variables → Post-response** for extraction. These are declarative rules, not JavaScript scripts.

For a login flow:

1. In **Variables**, add an extraction with the variable name `token`, source **JSON body**, and path `/token`.
2. In **Assertions**, add a check named `Successful login`, source **Status code**, operator **Equals**, and expected value `200`.
3. Send the request to try the current rules. Click **Save** when you want to keep your changes.
4. In another request, use <code v-pre>{{token}}</code> in the bearer token field and send it.

JSON paths use JSON Pointer: `/user/id`, `/items/0/name`, or an empty path for the entire response. Escape `/` in a property name as `~1` and `~` as `~0`. Header names are case-insensitive.

Assertions can check status, a JSON value, a header, or duration in milliseconds. Expected values use JSON: `200`, `true`, `null`, or a quoted string such as `"application/json"`. **In list** and **Not in list** accept scalar arrays such as `[200, 201]`; **Between (inclusive)** accepts `[min, max]`. Length checks accept a non-negative integer for strings or arrays. Regex checks accept a quoted pattern without `/` delimiters and have execution limits. Type checks and **Exists** need no expected value. Comparisons do not convert strings to numbers. **Exists** accepts an existing JSON `null`; extraction requires a non-null value. JSON rules cannot inspect binary, truncated, or invalid JSON responses.

**Test Results** counts only assertions. Extraction outcomes appear in a separate group without displaying extracted values; requests with extraction alone show **Variable extraction**. Extraction runs independently of whether assertions pass. A failed check does not hide the HTTP response. A failed extraction removes an earlier session value of the same name, preventing reuse of a stale token.

Open the **Variables inspector** next to **Environments** to inspect Environment and Session separately. Session variables override environment variables with the same name; overridden environment entries are marked. Session values and environment secrets remain masked. Extracted values stay in memory and are never automatically written into environments or the vault. **Clear session**, changing the environment or vault, and closing the app discard them; returning to a previous environment does not restore its session. The original server response remains visible in the response viewer and may itself contain sensitive data.

Rules are stored in a hidden YAML file alongside the HTTP collection, separately from request Markdown. Renaming, moving, duplicating, trashing, and restoring requests retain their rules. Older massCode versions ignore these files and do not execute the rules. If a rules file is unavailable in cloud storage, invalid, or from an unsupported format version, sending and saving rules are blocked until it is available and valid.

## Response Viewer

After a request is sent, the response panel shows:

- status, duration, and response size
- body and headers tabs
- JSON formatting for JSON responses
- copy action for response body and headers

HTTP has its own editor preferences, including line wrapping for request previews, request bodies, and response viewers.
