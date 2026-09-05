---
title: JavaScript Scripts
description: Run local pre-request scripts and response tests with explicit trust and bounded execution.
---

# JavaScript Scripts

Use **Scripts** in an HTTP request to compute variables before sending and test the response. WebSocket requests do not run scripts. Scripts use the massCode `mc` API; Postman and Bruno scripting APIs are not supported.

## Review and trust

1. Read both **Pre-request** and **Post-response & tests** scripts.
2. Click **Trust this code** on the Scripts tab.
3. Click **Send**. A valid unsaved draft can run without saving it.
4. Open **Tests** in the response panel for phase errors and JavaScript test results.

Trust is stored in local application data, separately from the vault. Copying or importing a vault does not copy trust. New requests start untrusted. Editing code invalidates trust; use **Revoke trust** to remove it explicitly. Saving the exact trusted draft preserves trust. Folder Runner checks trust for every saved request in its snapshot; an untrusted step fails before sending. Review and trust requests individually before starting a run.

::: warning Access to secrets
Trusted scripts can read request and response data and resolved environment/session variables, including secrets. They can insert values into the configured request and send them to its server. Review code before granting trust. Scripts cannot perform additional network requests, change the destination origin, read files, or access Node/Electron. Redirects are disabled for requests with scripts. Test names and results remain in memory; do not deliberately include secrets in test names. Literal known secrets are masked, but masking cannot detect every transformation.
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

const data = JSON.parse(mc.response.body)
mc.test('Token returned', () => {
  mc.assert(typeof data.token === 'string')
})
mc.variables.set('token', data.token)
```

| API | Behavior |
| --- | --- |
| `mc.request` | Read-only draft snapshot: `method`, `url`, `headers`, `body`. Template variables remain literal. No file paths are exposed. |
| `mc.response` | `null` before sending; after receiving: `status`, `headers`, `body`, `bodyKind`, `truncated`, `durationMs`. Read-only. |
| `mc.variables.get(name)` | Read a resolved variable, or `undefined`. |
| `mc.variables.set(name, value)` | Stage a string value in the current session. |
| `mc.variables.unset(name)` | Stage removal of the session override. The environment value becomes available on the next request. |
| `mc.test(name, callback)` | Record a pass if the callback completes without throwing. A failed test marks the workflow failed. |
| `mc.assert(condition)` | Throw when the condition is falsy. No implicit comparisons or assertion library. |

Scripts run in separate contexts. Transfer data between phases with variables, not global JavaScript objects. Only synchronous code is supported: no timers, `fetch`, `console`, imports, or Promise jobs.

## Execution and failure

The order is **pre-request → variable interpolation → HTTP → declarative assertions and extraction → post-response/JS tests → session commit**. Post-response can read extraction values and override them. Declarative checks evaluate the original response.

A pre-request error or failed pre-request test prevents sending. A transport error skips post-response. Post-response errors and failed JS tests preserve the HTTP response but discard all staged variable changes, including extraction. Declarative assertion failures remain visible and fail a Runner step; they do not by themselves roll back extraction. Unscripted requests retain their existing extraction behavior.

Manual requests share the selected environment's Session. Runner uses its own variables and does not read or update manual Session. **Cancel request**, Runner cancellation, environment/vault changes, and closing the request window terminate active work and prevent variable commits. Cancelling a request cannot undo a request already received by the server.

## Limits

Each phase accepts at most 64 KiB of source text (UTF-16 code units), 2 MiB of JSON input and 64 KiB of serialized output (UTF-16 code units). QuickJS has a 16 MiB heap, a 256 KiB stack and a 500 ms execution deadline. A separate 1.5 second watchdog includes worker startup and terminates the worker if needed. The worker's host JavaScript heap also has a separate limit. These are not a total operating-system RSS limit.

A phase allows up to 100 variable writes/removals and 100 tests. Variable names allow letters, digits, `_`, `.`, and `-`, up to 128 characters, excluding prototype-related names. Values allow up to 16,384 characters; test names allow up to 128. A large response may remain visible in the response panel while the script input limit rejects post-response.

Script exception text and stacks are intentionally hidden because they may contain secrets. After a timeout or memory failure, the next run starts with a fresh worker and engine.

## Storage and migration

Scripts, assertions and variable extraction rules live together in the `runtime` field of each HTTP request's Markdown frontmatter. Copying the `.md` file carries the complete request; local trust and secret values are not included.

```yaml
runtime:
  version: 2
  assertions: []
  extractions: []
  scripts:
    preRequest: |-
      mc.variables.set('itemId', '42')
      mc.assert(true)
    postResponse: |-
      mc.test('HTTP 200', () => mc.assert(mc.response.status === 200))
```

Existing `.runtime-<id>-<createdAt>.yaml` files migrate automatically when the vault is reconciled. The app removes a legacy file only after writing its contents into the request Markdown. Unavailable files retry after download; malformed or unsupported rules remain untouched and block execution. If both formats exist, inline runtime takes precedence; a different legacy copy is retained for recovery.

::: warning Older builds
Builds that only support separate runtime YAML files do not understand or preserve inline runtime. Do not use them to edit or execute requests in a migrated vault. Unknown inline runtime versions are blocked by builds supporting this format.
:::

## Local demo

From the repository checkout, run:

```sh
node scripts/http-scripts-demo.mjs
```

With the updated development app running, open its DevTools console and create a dedicated demo folder using its existing authenticated API bridge:

```js
await import('http://127.0.0.1:5189/seed.mjs')
```

Alternatively, if dev was started with a configured development session token, provide that same token as `MASSCODE_API_TOKEN` to the command-line seeder:

```sh
node scripts/http-scripts-demo.mjs --seed
```

The seeder creates only new demo requests and never grants trust. Each request's Description contains the expected outcome and UI steps. The server binds only to `127.0.0.1:5189`; it refuses to start if the port is already occupied.
