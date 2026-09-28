---
title: Debugging
description: "Inspect HTTP network traffic and script logs, use the native terminal, manage cookies, and troubleshoot request failures."
---

# Debugging

Use the HTTP **Console**, **Terminal**, and **Cookies** tools when the response alone does not explain a problem. They are available through the HTTP interface and command palette.

## Console

Open Console in the bottom dock, send a request, and select its network entry. Inspect the request URL, headers, body, response details, timing, and errors. Filter by text or log level, hide network entries to focus on scripts, and toggle timestamps. Switch to raw details when useful, copy a relevant entry, or copy the currently visible filtered log. The dock can be detached into a separate Console window when you need more room. Clear the log to start a focused debugging session.

<img :src="withBase('/http-console.png')" alt="HTTP Console with an expanded network request">

Previews describe the draft before scripts run. Console records execution details, so use it to investigate interpolation, actual headers, cookies, and redirect behavior. Console is a bounded in-memory diagnostic log, not permanent request history; older or large entries can be removed or truncated.

### Log from a script

```js
console.log('Preparing request', mc.request.method)
console.info('Selected item', mc.variables.get('itemId'))
console.warn('Check the response before continuing')
console.error('Diagnostic message')
// console.clear() clears the diagnostic log.
```

These methods are available in pre-request and post-response scripts. `console.error()` writes a log entry; use `mc.assert()` or a failing `mc.test()` to fail the workflow. Exceptions show a generic script error instead of arbitrary exception text or stacks. Add non-sensitive checkpoints to locate the failing step.

::: warning Actual data in diagnostics
Console, script logs, live responses, and terminal output can contain real request data and credentials. Do not assume preview or saved-history masking also sanitizes these surfaces. Avoid logging secrets; inspect copied output and screenshots before sharing them.
:::

## Terminal

Open Terminal to run commands in a native shell without leaving the HTTP workspace. Create a session, type commands, and use separate sessions for independent work. **Clear** clears the visible terminal output; closing a session ends that terminal session. Hiding the dock is different from closing a session.

For example, copy a cURL preview, replace masked values with appropriate local values, and run it to compare behavior. The shell needs the programs you invoke installed, and generated code may need dependencies described in [Code Generation](./requests#code-generation).

Terminal is your computer's shell, with its normal permissions and command effects. It does not use the JavaScript script sandbox, automatically inject the selected environment, or share the HTTP cookie jar with command-line clients.

## Cookies

The Cookies manager shows the local HTTP cookie jar in one table. Search by cookie name or domain to narrow the rows. The client retains cookies from responses and sends matching cookies on later requests when cookie-jar use is enabled. This jar is independent of your browser's cookies and is stored locally rather than in the Markdown Vault.

1. Open **Cookies** and click **Add cookie**.
2. Check **Domain** first. A new cookie uses the current literal request URL when possible; if the URL contains an unresolved placeholder such as <code v-pre>{{baseUrl}}</code>, it can default to `localhost`. Enter the intended host explicitly.
3. Edit **Name**, **Value**, **Domain**, and **Path** in the table. Set **Expires**, **Secure**, and **HttpOnly** as needed. Cell edits, dates, and checkbox changes are saved immediately.
4. To edit a full `Set-Cookie` string, click the row's raw-code icon, edit the string, then click **Save**. The raw editor also accepts attributes such as `Max-Age` that do not have separate table controls.
5. Send a request to a matching URL and inspect the outgoing cookie in Console.

A raw example with a non-sensitive value:

```text
practice=hello; Path=/; Max-Age=3600; Secure; HttpOnly
```

A cookie without a Domain attribute is host-only; a Domain attribute sets its applicable domain scope. **Secure** restricts sending to secure connections, and **HttpOnly** is retained as a cookie attribute. Expires and Max-Age control lifetime. Use the expiry picker to set or clear a date; a cookie without expiry or Max-Age is a session cookie.

Delete a row with its trash icon, or use **Clear all cookies** to empty the jar. The search filter does not turn Clear all cookies into a domain-only operation.

The request's cookie toggle immediately enables/disables automatic jar use; it is saved separately from request content. An explicit `Cookie` header is separate from that toggle. If a request authenticates unexpectedly, inspect both its manual header and the jar.

<img :src="withBase('/http-cookies.png')" alt="Cookies table with editable domain, path, expiry, and flags">

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| A placeholder remains in the URL | Select the intended environment, check spelling and enabled collection variables, and inspect unresolved references in Variables. |
| An old token keeps winning | Look for a Session override, an explicit Authorization header, inherited auth, and cookies. Clear Session or update the correct scope. |
| A secret is empty on another device | Enter its local value in that environment; secret values do not sync with the vault. |
| `401` or `403` | Check the API's required auth method, credential scope/expiry, header/query placement, and actual outgoing details in Console. |
| Timeout, DNS, or connection error | Verify the host/port, internet or VPN access, server availability, and request timeout. `localhost` means the machine running massCode. |
| TLS failure | Check hostname and certificate trust. For a known local test server, a scoped verification override can help isolate the problem. |
| HTTP/2 error | Try Auto or HTTP/1.1 if the server does not support forced HTTP/2. |
| Missing/partial JSON | Check response content type and truncation, raise the size cap if necessary, and resend. |
| HTTP 200 but workflow failed | Inspect assertions, extraction, JavaScript tests, and GraphQL errors. |
| Script will not run | Review every applicable scope, grant trust to the current code, and remove unsupported imported code only after adapting it. |
| A variable disappeared after extraction | A missing/null extraction removes the prior temporary value. Script failure instead rolls staged changes back. |
| Manual Send works but Runner fails | Save edits, prepare a fresh run, select the intended environment, and put token/setup requests first. Runner starts without manual Session values. |
| A moved request behaves differently | Review its new parent auth, headers, variables, checks, and scripts. |
| A saved snapshot differs from the live response | History is redacted and has a separate 1 MiB body cap; it is not a lossless capture. |

For WebSocket-specific failures, check its URL scheme, handshake headers, auth, message limit, and reconnect rules in [WebSocket](./websocket).

<script setup>
import { withBase } from 'vitepress'
</script>
