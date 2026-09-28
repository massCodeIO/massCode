---
title: Authorization
description: "Configure inherited, Bearer, Basic, and API key authentication for HTTP requests and collections."
---

# Authorization

Use **Auth** on a request, collection, or nested folder to choose how it authenticates. Put common credentials on the collection and choose **Inherit from parent** in its children to avoid repeating them.

## Choose an auth method

| Method | Fields and outgoing behavior |
| --- | --- |
| **None** | Adds no generated authentication. On a child, this explicitly stops parent auth inheritance. |
| **Inherit from parent** | Uses the effective parent collection/folder auth. The editor identifies the inherited source. With no parent auth, it resolves to None. |
| **Bearer Token** | Enter a token; massCode creates `Authorization: Bearer …`. Enter the token only, without another `Bearer` prefix. |
| **Basic Auth** | Enter username and password; massCode encodes them into the HTTP Basic `Authorization` header. Base64 encoding is not encryption: use HTTPS. |
| **API Key** | Enter the key name, its value, and choose **Header** or **Query** placement. Use the exact name required by the API, such as `X-API-Key`. |

A top-level collection has no parent to inherit from. A nested folder or request can inherit, choose its own auth, or select None. Auth is one effective method, not a stack of the collection's and request's methods.

<img :src="withBase('/http-auth-inheritance.png')" alt="Request Auth tab using Inherit from parent for the Northstar API">

## Reuse a secret token

1. Open the environment manager and create a [secret variable](./environments#secret-variables) named `apiToken`.
2. Select that environment.
3. On the collection's **Auth** tab, select Bearer Token and enter <code v-pre>{{apiToken}}</code>.
4. Save the collection. On each child request, choose **Inherit from parent** and save it.
5. Send one request and inspect the response. Use the Variables inspector to check which scope supplies `apiToken` if authorization fails.

The same variable syntax works in Basic credentials and API key fields. Request previews mask secrets and Session values. Sending uses real values.

## Explicit headers and query parameters

Avoid configuring the same credential in both Auth and a manually entered `Authorization` header. Conflicting values can produce unexpected authentication; inspect the outgoing header in [Console](./debugging#console). **None** does not delete headers you entered manually or cookies from the cookie jar.

For API keys, the generated entry replaces existing entries with the same name in the chosen location (case-insensitive for headers, exact name for query parameters). Check the selected placement before sending. The API's documentation determines whether it expects a header, a query parameter, a token prefix, or a completely different mechanism.

## Unsupported auth workflows

The Auth editor has no OAuth authorization/token-refresh flow, Digest, NTLM, AWS signing, or client-certificate manager. If an API accepts an already-issued bearer token, obtain it through that API's documented process and store it as a secret. For login endpoints that return a token, use [response extraction](./tests#pass-a-login-token-to-another-request) to pass it between requests.

::: warning Credentials in saved content
Literal values in request and collection auth, headers, query parameters, or bodies are plain text in the vault. Use secret variables for reusable credentials. The live response, Console, and script logs may show actual data; review them before copying or sharing.
:::

<script setup>
import { withBase } from 'vitepress'
</script>
