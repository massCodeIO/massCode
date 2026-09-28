---
title: HTTP Settings
description: "Set global transport defaults and per-request overrides for timeouts, redirects, protocols, TLS, previews, and history."
---

# HTTP Settings

Open **Settings → HTTP** for application-wide defaults. Use the selected request's **Settings** panel for transport overrides. The command palette can open either surface.

## Defaults and overrides

A request's **Inherit** choice uses the current global setting. For numeric fields, clear the value to inherit the displayed default. Choose an explicit value only when this request needs different behavior, then **Save** the request. Global interface preferences are saved locally.

Request transport settings take precedence over global defaults. Collection/folder auth and headers have their own [inheritance rules](./collections#inheritance); transport inheritance here refers to the global HTTP preferences.

<img :src="withBase('/http-settings.png')" alt="Per-request transport settings and cookie jar control">

## Transport settings

| Setting | Default and effect |
| --- | --- |
| Timeout | **30,000 ms**. `0` disables the request timeout. |
| Maximum response size | **10 MB** by default. `0` removes this size cap. Larger responses are truncated when a cap applies. |
| HTTP version | **HTTP/1.1** by default. **Auto** negotiates HTTP/2 when supported; **HTTP/2** requires HTTPS and successful HTTP/2 negotiation. |
| Encode URL | **On**. Encodes the URL for transport; turn it off only if your endpoint requires a deliberately pre-encoded URL. |
| Follow redirects | On for ordinary HTTP requests by default. GraphQL and scripted requests use a restricted default with redirects off. |
| Maximum redirects | **5**; allowed range **0–100**. Controls the redirect limit when following is enabled. |
| Follow original HTTP method | Controls whether a redirect keeps the original method/body. The inherited behavior follows the transport's normal redirect rules; an explicit value overrides it. |
| Follow Authorization header | **Off**. Controls forwarding authorization on redirects. |
| Remove Referer header on redirect | **Off**. Enable to remove the referer when following redirects. |
| SSL certificate verification | **On** globally. A request can override certificate verification in its settings. |

Use Console to inspect the actual exchange. WebSocket has its own fixed connection timeout and does not follow HTTP redirect settings.

::: warning Redirects and TLS
Forwarding Authorization can expose credentials to a redirect destination. Disabling certificate verification prevents the client from verifying the server's identity. Use these overrides only for endpoints and development environments where you understand the consequences, and return to inherited verification afterwards.
:::

## Interface preferences

- **Wrap lines** applies to request bodies, previews, and response viewers.
- **Default preview format** chooses the language and client shown when opening a request preview. The preview toolbar can choose another generator.
- **Automatically show response** switches the lower panel to the response tab after sending. If the panel is hidden, open it with the bottom-panel toggle in the editor header.
- **History** selects the number of retained sends per request, or disables recording. See [Responses & History](./responses#request-history) for snapshot limits and redaction.

The request's cookie toggle controls automatic cookie-jar use immediately and independently of the content Save action. See [Cookies](./debugging#cookies) for managing that local jar.

<script setup>
import { withBase } from 'vitepress'
</script>
