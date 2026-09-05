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

The initial order is oldest-created requests first within each folder, followed by its child folders in sidebar order. Changing the run order does not reorder requests in the library. WebSocket entries are excluded. A run supports up to 500 HTTP requests. Folders without HTTP requests, unavailable requests, and invalid or unsupported rules prevent preparation before any request is sent.

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

## WebSocket

Choose **WebSocket** in the method/type selector beside the URL. Existing saved requests remain HTTP unless you change their type.

1. Enter a `ws://` or `wss://` URL and configure **Params**, **Headers**, and **Auth** as needed. Basic and bearer authentication are supported. WebSocket handshake headers are managed by the client; do not add `Host`, `Connection`, `Upgrade`, or `Sec-WebSocket-*` headers manually.
2. Click **Connect**. Connecting uses the current draft without saving it. Connection attempts time out after 15 seconds. TLS certificates are verified unless you explicitly disable verification in HTTP settings. Redirects are not followed.
3. Write text or JSON in **Message**, then click **Send message**. JSON is sent as text without additional validation. An empty message is allowed.
4. Inspect received and sent messages in **Messages**, then click **Disconnect** when finished. **Clear messages** clears the log without disconnecting.

Environment and manual Session variables are captured when connecting, with Session taking priority. Use <code v-pre>{{name}}</code> in the URL, params, headers, auth, or outgoing messages. Later edits to connection settings or variable values require reconnecting. Known secret and Session placeholders are masked in the outgoing log; incoming server messages are shown as received and may contain sensitive data.

**Save** persists the request type, connection settings, and message draft in the vault, not the conversation. The log keeps the latest 100 messages in memory, with previews limited to 16 KiB. Messages larger than 1 MiB are rejected; an oversized incoming message closes the connection. Received binary messages are displayed as Base64 previews. Sending binary files is not supported.

Switching requests, changing the environment or vault, clearing Session, leaving the HTTP space, or reloading or quitting the app closes the connection. Returning to the request does not reconnect automatically. Reconnecting starts a new log.

WebSocket requests do not run assertions, response extraction, scripts, code generation, or Folder Runner steps. Socket.IO and subprotocol negotiation are not supported.

### Try a local connection

The source repository includes a local-only demo server. With the repository dependencies installed, run `node scripts/http-websocket-demo.mjs` from the repository root. Leave that terminal running while testing; stop it with Ctrl+C. The server is a development fixture, not a service required by the app.

For a simple echo, connect to `ws://127.0.0.1:5188` and send any message. To test connection settings as well:

1. Set the URL to `ws://127.0.0.1:5188/protected`.
2. In **Params**, add `channel` with value `notifications`.
3. In **Headers**, add `X-Client-ID` with value `masscode-demo`.
4. In **Auth**, select **Bearer Token** and enter `demo-token` (without the `Bearer` prefix).
5. Click **Connect**. The first received message confirms `authenticated: true`, `channel: "notifications"`, and `clientId: "masscode-demo"`. The server never returns the token.
6. Send a message and check that the same text arrives back.

Change the channel to `updates`, then disconnect and reconnect: the new confirmation must show `updates`. Connection settings do not change an already-open connection. An incorrect or missing token rejects the handshake with **HTTP 401**; a missing channel or client ID rejects it with **HTTP 400**. Restore the correct settings and click **Connect** to retry. The built-in demo credentials are only for this localhost fixture; use your server's credentials for real connections.

## Storage

HTTP data is stored in your vault under the `http` folder. Requests are markdown files with YAML frontmatter, so they can be backed up and synced together with the rest of your massCode data.

<script setup>
import { withBase } from 'vitepress'
</script>
