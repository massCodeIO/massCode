---
title: Responses & History
description: "Read HTTP and GraphQL results, inspect response data and tests, and compare retained request snapshots."
---

# Responses & History

After **Send**, the response panel shows the HTTP status, elapsed time, response size, and the returned body and headers. A completed HTTP exchange and a passing workflow are different: `200` can still contain failed assertions or GraphQL errors.

If the lower panel is hidden, use the bottom-panel toggle in the top-right editor header, then select **Response**. The automatic response-switch preference changes the selected tab but does not reopen a hidden panel.

## Inspect the current response

1. Check status first. A missing status with an error usually means the exchange did not complete.
2. Open **Body** to read the server's content. JSON responses are formatted for inspection; text stays readable, and binary content is identified separately.
3. Open **Headers** for content type, caching, rate limits, request IDs, or other server metadata.
4. Use the copy action for the body or headers you need.
5. Open **Test Results** for assertion and JavaScript test results. Extraction results appear separately and do not expose extracted values.

<img :src="withBase('/http-params-response.png')" alt="Enabled query parameters and the JSON response for a product filter">

For request and redirect details, use [Console](./debugging#console).

### Truncated and binary responses

The [maximum response size](./settings#transport-settings) controls how much response content massCode reads. A truncation indicator means the visible body is incomplete. JSON extraction and JSON-based tests cannot safely inspect truncated or binary content. Raise the limit only when you need the full payload, then send again.

The current response may contain credentials or personal data exactly as the server returned them. Preview masking does not sanitize that live body.

### Errors and test failures

A network, TLS, DNS, timeout, or cancellation error is shown as an execution error. HTTP `4xx` and `5xx` responses still have a body and headers worth reading. A failed assertion leaves the response visible. Script failures may prevent sending or roll back temporary variables; see [Execution and failure](./scripts#execution-and-failure).

GraphQL can return partial `data` together with `errors` under HTTP `200`. Check its error indicator and full envelope; see [GraphQL](./graphql#read-the-response).

## Request history

<AppVersion text=">=5.11" />

Open **History** in the request's lower panel to inspect earlier sends for that request. The collection **Overview** also shows its five most recent request entries. Select an entry in either surface to open its saved request and response snapshot, including headers, body, status, timing, and any saved error.

<img :src="withBase('/http-history.png')" alt="Saved request and response snapshot with redacted credentials">

History is for inspection. Selecting an entry does not restore its request into the editor, change the current draft, or resend it. To reproduce a past request, edit the current request deliberately and send it again.

### Retention and redaction

**Settings → HTTP → History** selects **Off**, **10**, **20**, **50**, or **100** entries per request; the default is **20**. Each saved request body and response body is capped at **1 MiB**, independently of the live-response size limit. A snapshot can therefore be truncated even if the current response was complete.

Saved snapshots redact known secret and Session values and credential-like fields such as authorization, cookies, tokens, passwords, and API keys. Redaction also applies to saved URLs and error text. Partial structured bodies that cannot be safely processed may be replaced with a redaction marker.

These snapshots are not a lossless replay record. Redaction cannot recognize every custom credential format or transformed secret, so review stored content before sharing your vault. Older entries may have less detail than newly recorded snapshots.

Folder Runner requests also create history entries and snapshots under the same retention settings. The runner’s consolidated step results and temporary variables remain separate from those snapshots. WebSocket conversations do not populate HTTP history; their message logs are temporary.

<script setup>
import { withBase } from 'vitepress'
</script>
