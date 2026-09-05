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
- save repeatable requests by project or service
- import collections from OpenAPI, Postman, or Bruno
- keep request descriptions close to implementation notes
- switch variables between local, staging, and production environments
- check responses with assertions and pass extracted values to subsequent requests
- run a folder of requests sequentially with an isolated set of temporary variables
- copy a request as raw HTTP, cURL, fetch, or axios for debugging and integration

## Main Concepts

### [Requests](/documentation/http/requests)

Requests store the method, URL, params, headers, body, auth settings, description, assertions, and response extraction rules. **Send** runs the current draft without saving it; **Save** next to Send keeps changes across all tabs. Use <kbd>⌘</kbd> + <kbd>S</kbd> on macOS or <kbd>Ctrl</kbd> + <kbd>S</kbd> on Windows and Linux to save, and <kbd>Cmd+Enter</kbd> / <kbd>Ctrl+Enter</kbd> to send. Changes are not autosaved.

### [Environments](/documentation/http/environments)

Environments store reusable variables for local, staging, and production APIs. Temporary Session variables hold extracted response values and override environment variables with the same name. Use the **Variables inspector** next to Environments to inspect both scopes. Previews mask secrets and Session values; sending uses their real values.

### [Importing Collections](/documentation/http/importing)

Importing creates HTTP folders, requests, and environments from external collection files. HTTP supports OpenAPI JSON/YAML, Postman Collection v2.1 JSON with optional Postman Environment JSON, and Bruno OpenCollection YAML or ZIP exports.

## Folders

HTTP requests are organized in folders. Selecting a folder shows its requests and selects the first request in that folder. Folders support nesting, drag and drop ordering, inline rename, and custom folder icons.

Right-click a folder and choose **Set Icon** to select a built-in Material or Lucide icon. Choose **Remove Icon** to restore the default folder icon.

### Run a Folder

Right-click an HTTP folder and choose **Run folder** to run its saved requests, including nested folders, in sequence.

1. Save or discard any changes in the current request when prompted. Cancelling keeps the editor open without preparing a run.
2. Review the prepared list and environment. Drag anywhere on a request row to change the order for this run only. Reordering is disabled during execution.
3. Leave **Continue on failure** unchecked to stop at the first failed step, or enable it to run the remaining steps after failures.
4. Click **Run**. Each step shows its HTTP status, duration, assertion results, and extraction results.

The initial order is oldest-created requests first within each folder, followed by its child folders in sidebar order. Changing the run order does not reorder requests in the library. A run supports up to 500 requests. Empty folders, unavailable requests, and invalid or unsupported rules prevent preparation before any request is sent.

The runner snapshots saved requests and the active environment when you open it. Later edits do not change that prepared run. Choose **Prepare new run** after completion to load the latest saved data.

#### Variables and failures

Each run starts with an empty temporary variable scope over the selected environment. Successful **Variables → Post-response** extractions make values available to subsequent steps through <code v-pre>{{name}}</code>, overriding environment variables with the same name. Failed extractions remove the previous run value for that name. Extraction runs independently of assertion results.

Manual **Session** values are not read or changed by the runner. Run variables are discarded at the end and are not shown in the Variables inspector.

A network error, HTTP status of 400 or higher, failed assertion, or failed extraction marks a step as failed. When stopping on failure, the remaining steps are marked as skipped.

**Stop run** aborts the active request and skips remaining steps. Closing the runner, reloading the app, switching vault or environment, or clearing the manual Session also cancels an active run. Cancellation cannot undo a request already received by the server.

Results remain available only while the runner is open. Runs do not write request history, response bodies, or temporary variables to the vault.

### Emoji and Uploaded Images

<AppVersion text=">=5.9" />

The icon picker also supports platform-native emoji and uploaded JPG or PNG images. Uploaded images can be previewed before applying and are cropped from the center and resized to 128×128.

## Storage

HTTP data is stored in your vault under the `http` folder. Requests are markdown files with YAML frontmatter, so they can be backed up and synced together with the rest of your massCode data.

<script setup>
import { withBase } from 'vitepress'
</script>
