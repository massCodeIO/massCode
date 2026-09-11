---
title: JavaScript Scripts
description: Run local pre-request scripts and response tests with explicit trust and bounded execution.
---

# JavaScript Scripts

<AppVersion text=">=5.11" />

Use **Scripts** in a request, collection, or nested folder to compute variables before sending and test the response. WebSocket requests do not run scripts. Scripts use the massCode `mc` API; Postman and Bruno scripting APIs are not supported.

## Review and trust

1. Read both **Pre-request** and **Post-response** scripts.
2. Click **Trust this code** on the Scripts tab.
3. Click **Send**. A valid unsaved draft can run without saving it.
4. Open **Test Results** in the response panel for phase errors and JavaScript test results.

Trust is stored in local application data, separately from the vault. Copying or importing a vault does not copy trust. New requests start untrusted. Editing code invalidates trust; use **Revoke trust** to remove it explicitly. Saving the exact trusted draft preserves trust. Folder Runner checks trust for every saved request in its snapshot; an untrusted step fails before sending. Review and trust every applicable request, folder, and collection scope before starting a run.

::: warning Access to secrets
Trusted scripts can read request and response data and resolved environment/session variables, including secrets. They can insert values into the configured request and send them to its server. Review code before granting trust. Scripts cannot perform additional network requests, change the destination origin, read files, or access Node/Electron. Redirects default to disabled for requests with scripts; review any explicit transport override. Test names and results remain in memory; do not deliberately include secrets in test names. Diagnostic console output can contain actual values; do not assume script logs are masked.
:::

## API

```js
// Pre-request: values are strings and override environment variables.
mc.variables.set('itemId', '42')
mc.variables.set('payload', JSON.stringify({ itemId: 42 }))
```

Use <code v-pre>{{itemId}}</code> in a query value or <code v-pre>{{payload}}</code> in the request body. Pre-request changes may alter the path or query but must preserve the URL's original scheme, hostname and port.

```js
// Post-response: assertions use a synchronous callback.
mc.test('HTTP 200', () => {
  mc.assert(mc.response.status === 200)
})

const data = mc.response.json()
mc.test('Token returned', () => {
  mc.assert(typeof data.token === 'string')
})
mc.variables.set('token', data.token)
```

| API | Behavior |
| --- | --- |
| `mc.request` | Read-only draft snapshot: `method` and `url` are strings, `headers` is an array of `{ key, value }` entries, and `body` is a string or `null`. Template variables remain literal. For a Binary payload, `body` can contain the selected local file path. This is metadata; scripts cannot read the file. |
| `mc.response` | `null` before sending; after receiving: `status` and `durationMs` are numbers, `headers` is an array of `{ key, value }` entries, `body` is a string, `bodyKind` is `json`, `text`, or `binary`, and `truncated` is a boolean. Read-only. |
| `mc.response.json()` | Parse and cache the response JSON. Throws for invalid JSON, binary content, or a truncated body. |
| `mc.environment.get(name)` | Read only the selected environment scope, including secrets, without a Session override; returns `undefined` when absent. |
| `mc.collectionVariables.get(name)` | Read effective collection/folder variables without environment or Session overrides. |
| `mc.variables.get(name)` | Read a resolved variable, or `undefined`. |
| `mc.variables.set(name, value)` | Stage a string value in the current session. |
| `mc.variables.unset(name)` | Stage removal of the session override. The saved environment or collection/folder value becomes available on the next request, if present. |
| `mc.test(name, callback)` | Record a pass if the callback completes without throwing. A failed test marks the workflow failed. |
| `mc.assert(condition)` | Throw when the condition is falsy. No implicit comparisons or assertion library. |

Scripts run in separate contexts. Transfer data between phases with variables, not global JavaScript objects. Only synchronous code is supported: no timers, `fetch`, imports, or Promise jobs. `mc.test()` callbacks must be synchronous; returning a Promise fails the test.

The supported logging methods are `console.log`, `console.info`, `console.warn`, `console.error`, and `console.clear`. They write to [Console](./debugging#console); an error log alone does not fail a test. Log non-sensitive identifiers and checkpoints, not credentials.

<img :src="withBase('/http-scripts.png')" alt="Create order JavaScript script with two passing tests">

## Execution and failure

The order is **pre-request → variable interpolation → HTTP → declarative assertions and extraction → post-response/JS tests → session commit**. Pre-request scopes run collection → folders → request. Native post-response scopes run request → inner folders → collection; imported Postman collections retain parent-first post-response ordering. See [Collections](./collections#script-execution-order). Post-response can read extraction values and override them. Declarative checks evaluate the original response.

A pre-request error or failed pre-request test prevents sending. A transport error skips post-response. Post-response errors and failed JS tests preserve the HTTP response but discard all staged variable changes, including extraction. Declarative assertion failures remain visible and fail a Runner step; they do not by themselves roll back extraction.

Manual requests share the selected environment's Session. Runner uses its own variables and does not read or update manual Session. **Cancel request**, Runner cancellation, environment/vault changes, and closing the request window terminate active work and prevent variable commits. Cancelling a request cannot undo a request already received by the server.

## Limits

Each phase has a 500 ms execution limit. Exceeding a time, memory, or data limit fails the phase and discards its variable changes.

A phase allows up to 100 variable writes/removals and 100 tests. Variable names allow letters, digits, `_`, `.`, and `-`, up to 128 characters, except `__proto__`, `constructor`, and `prototype`. Values allow up to 16,384 characters; test names allow up to 128. A large response may remain visible in the response panel while the script input limit rejects post-response.

Script exception text and stacks are intentionally hidden because they may contain secrets. After correcting the script or reducing the data it processes, send the request again.

<script setup>
import { withBase } from 'vitepress'
</script>
