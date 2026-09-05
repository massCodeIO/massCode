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
- **Scripts** - run trusted [pre-request scripts and JavaScript tests](/documentation/http/scripts)
- **Description** - markdown notes for the request
- **Variables** - extract response values into temporary session variables under **Post-response**
- **Assertions** - define declarative checks for the request

### Drafts and Explicit Saving

<AppVersion text=">=5.11" />

Use the **Save** icon next to Send or <kbd>⌘+S</kbd> on macOS / <kbd>Ctrl+S</kbd> on Windows and Linux to save request fields, scripts, assertions, and variable extraction. Changes are not autosaved. A green dot on Save indicates unsaved edits; saving invalid rules opens the tab containing the first error. Before switching requests or leaving the HTTP space, choose **Save**, **Discard changes**, or **Cancel**. If saving fails partway through, remaining unsaved edits stay in the editor for retry.

**Send** uses the current request fields, trusted scripts, assertions, and variable extraction without saving them. Invalid rules are highlighted before sending; unsaved changes remain in the editor after execution.

## Body

Use the body tab to choose the payload format for methods that send data.

- **JSON** and **Text** use a CodeMirror editor.
- **Form URL Encoded** uses key-value rows.
- **Multipart Form Data** supports text and file rows.

## Sending Requests

Send the selected request with one of these methods:

- Click the send button next to the URL field.
- Select **"Editor"** > **"Send Request"** from the menu bar.
- Press <kbd>⌘+Enter</kbd> on macOS or <kbd>Ctrl+Enter</kbd> on Windows or Linux.

## Preview

The lower panel can show the outgoing request before it is sent.

- **HTTP** preview shows the request line, host, headers, and body.
- **cURL** preview builds a command you can paste into a terminal.
- **fetch** and **axios** generate JavaScript from the current draft, including unsaved edits.

Use the copy button in the preview panel to copy the active preview.

### JavaScript Code Generation

<AppVersion text=">=5.11" />

JavaScript previews resolve regular environment variables and mask secret and Session values. Unresolved variables remain as placeholders. Copied snippets contain the same masks, so supply real values in your own execution environment. The axios snippet assumes that your project has axios installed.

Previews do not run scripts, and generated snippets do not include pre-request or post-response scripts, assertions, or extraction rules. Variables created by scripts may remain unresolved or appear as Session masks. Add any required variable preparation and response checks to your own code.

For multipart uploads, JavaScript snippets accept `File` or `Blob` arguments in field order instead of copying local file paths. The browser generates the multipart boundary, so a manually entered `Content-Type` is omitted. Fetch cannot send a body with GET or HEAD; the preview warns you to change the method or remove the body.

## Tests and Variables

Use **Assertions** to check responses and **Variables → Post-response** to extract values for subsequent requests. See [Tests & Variables](/documentation/http/tests) for setup, supported operators, and results. For pre-request code and JavaScript tests, see [JavaScript Scripts](/documentation/http/scripts).

## Response Viewer

After a request is sent, the response panel shows:

- status, duration, and response size
- body and headers tabs
- JSON formatting for JSON responses
- copy action for response body and headers

HTTP has its own editor preferences, including line wrapping for request previews, request bodies, and response viewers.

For GraphQL queries and mutations with JSON variables and operation selection, see [GraphQL](./graphql).
