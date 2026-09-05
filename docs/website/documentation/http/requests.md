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

Use the **Save** icon next to Send or <kbd>⌘</kbd> + <kbd>S</kbd> on macOS / <kbd>Ctrl</kbd> + <kbd>S</kbd> on Windows and Linux to save request fields, assertions, and variable extraction. Changes are not autosaved. A green dot on Save indicates unsaved edits; saving invalid rules opens the tab containing the first error. Before switching requests or leaving the HTTP space, choose **Save**, **Discard changes**, or **Cancel**. If saving fails partway through, remaining unsaved edits stay in the editor for retry.

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

JavaScript previews resolve regular environment variables and mask secret and Session values. Unresolved variables remain as placeholders. Copied snippets contain the same masks, so supply real values in your own execution environment. The axios snippet assumes that your project has axios installed.

For multipart uploads, JavaScript snippets accept `File` or `Blob` arguments in field order instead of copying local file paths. The browser generates the multipart boundary, so a manually entered `Content-Type` is omitted. Fetch cannot send a body with GET or HEAD; the preview warns you to change the method or remove the body.

## Tests and Extracted Variables

Use **Assertions** for checks and **Variables → Post-response** for extraction. These are declarative rules, not JavaScript scripts.

Use **Add assertion** or **Add extraction** at the bottom of the corresponding tab. Each request supports up to 100 assertions and 100 extractions. Extraction names must be unique and contain only letters `A–Z` / `a–z`, digits, underscores, dots, or hyphens; `__proto__` is reserved.

For a login flow:

1. In **Variables**, add an extraction with the variable name `token`, source **JSON body**, and path `/token`.
2. In **Assertions**, add a check named `Successful login`, source **Status code**, operator **Equals**, and expected value `200`.
3. Send the request to try the current rules. Click **Save** when you want to keep your changes.
4. In another request, use <code v-pre>{{token}}</code> in the bearer token field and send it.

JSON paths use JSON Pointer: `/user/id`, `/items/0/name`, or an empty path for the entire response. Escape `/` in a property name as `~1` and `~` as `~0`. Header names are case-insensitive.

Assertions can check status, a JSON value, a header, or duration in milliseconds. Expected values use JSON: `200`, `true`, `null`, or a quoted string such as `"application/json"`.

| Operator | Expected value | What it checks |
| --- | --- | --- |
| Equals / Does not equal | JSON scalar, such as `200` or `"ok"` | Strict equality or inequality; strings are not converted to numbers |
| Exists | None | The selected value exists; JSON `null` counts as existing |
| Contains / Does not contain | Quoted string, such as `"json"` | Case-sensitive substring match on a string, not array membership |
| Starts with / Ends with | Quoted string, such as `"application/"` | Case-sensitive string prefix or suffix |
| Matches regex / Does not match regex | Quoted pattern, such as `"^user-[0-9]+$"` | A string matches or does not match the regular expression |
| Length equals | Non-negative integer, such as `3` | String length or number of array items |
| Greater than / Greater than or equal | Number, such as `200` | Numeric lower bound, exclusive or inclusive |
| Less than / Less than or equal | Number, such as `500` | Numeric upper bound, exclusive or inclusive |
| Between (inclusive) | Two numbers, such as `[200, 299]` | Numeric value lies within both bounds; minimum must not exceed maximum |
| In list / Not in list | Scalar array, such as `[200, 201]` | Scalar membership using exact types; up to 1000 entries |
| Is string / Is number / Is boolean | None | The selected value has that JSON type |
| Is array / Is object / Is null | None | The selected value is an array, a non-null object excluding arrays, or `null` |

Regex patterns use JavaScript Unicode mode, without `/` delimiters or selectable flags. Patterns are limited to 1024 characters and evaluated strings to 1,000,000 characters. Execution has a 20 ms limit per regex and a shared 100 ms budget per response; exceeding a limit fails the check, including **Does not match regex**. String length uses JavaScript UTF-16 code units, so some emoji count as two.

A missing value fails any check, including negative operators. Extraction requires a non-null value. JSON rules cannot inspect binary, truncated, or invalid JSON responses. Invalid rule inputs show errors below their fields and prevent sending; a valid rule that does not match the response is reported as **Failed** after the request runs.

**Test Results** counts only assertions. Extraction outcomes appear in a separate group without displaying extracted values; requests with extraction alone show **Variable extraction**. Extraction runs independently of whether assertions pass. A failed check does not hide the HTTP response. A failed extraction removes an earlier session value of the same name, preventing reuse of a stale token.

Open the **Variables inspector** next to **Environments** to inspect Environment and Session separately. Session variables override environment variables with the same name; overridden environment entries are marked. Session values and environment secrets remain masked. Extracted values stay in memory and are never automatically written into environments or the vault. They can be reused across subsequent requests until replaced or cleared. See [Session Variables and Inspector](/documentation/http/environments#session-variables-and-inspector) for priority and lifecycle details. The original server response remains visible in the response viewer and may itself contain sensitive data.

Rules are stored in a hidden YAML file alongside the HTTP collection, separately from request Markdown. Renaming, moving, duplicating, trashing, and restoring requests retain their rules. Older massCode versions ignore these files and do not execute the rules. If a rules file is unavailable in cloud storage, invalid, or from an unsupported format version, sending and saving rules are blocked until it is available and valid.

## Response Viewer

After a request is sent, the response panel shows:

- status, duration, and response size
- body and headers tabs
- JSON formatting for JSON responses
- copy action for response body and headers

HTTP has its own editor preferences, including line wrapping for request previews, request bodies, and response viewers.
