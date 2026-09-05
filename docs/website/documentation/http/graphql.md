---
title: GraphQL
description: Send GraphQL queries and mutations with variables, operation selection, and HTTP workflows.
---

# GraphQL

<AppVersion text=">=5.11" />

Open **Body** and choose **GraphQL** as the body type. This sets the HTTP method to **POST**. GraphQL uses the same HTTP client as other requests.

<img :src="withBase('/http-graphql.png')" alt="GraphQL query with JSON variables, operation selection and a successful response">

## Send a query or mutation

1. Enter your endpoint URL and configure **Headers** or **Auth** as needed.
2. Enter a GraphQL document in **Query / mutation**.
3. Enter a JSON object in **Variables**. GraphQL variables use `$name` in the document.
4. Select an **Operation** when the document contains multiple named operations. **Automatic** works only for a single operation.
5. Click **Send**. You can send an edited draft before saving it. Click **Save** to retain the document, variables, selected operation and other request settings in your local vault.

```graphql
query User($id: ID!) {
  user(id: $id) { id name }
}
```

```json
{ "id": "1" }
```

The document editor provides syntax highlighting. Syntax errors, invalid JSON variables, ambiguous operation selection and unsupported subscriptions prevent network sending. Field names, arguments and variable types are checked by the server against its schema; local syntax validation does not replace that check.

Incomplete variables can be saved and reopened without losing their text. Duplication includes the GraphQL draft.

## Variables, tests and scripts

Use environment and Session references inside the variables JSON, URL, headers or auth fields. For example:

```json
{ "id": "{{userId}}" }
```

The existing priority applies: Session overrides environment values. Pre-request scripts can update execution variables. Substitution happens before the variables JSON is parsed, so strings must remain valid JSON after substitution. Use GraphQL variables instead of interpolating input directly into the GraphQL document.

Assertions and extraction receive the full response envelope. Use JSON pointers such as `/data/user/id` and `/errors` in [Tests & Variables](./tests). Post-response scripts also receive the full response. Extraction follows the existing HTTP workflow, including partial responses; add appropriate assertions for your API.

[Folder Runner](./runner) includes saved GraphQL requests and uses its isolated variables. A GraphQL error response fails the step even when HTTP status is 200 and there are no failing assertions. Invalid or truncated GraphQL responses also fail the step. The original response is visible when sending the request individually; Runner displays the outcome and test results.

## Read the response

HTTP status and GraphQL outcome are separate. A response can contain both `data` and `errors`, including with HTTP 200. massCode displays the full body and a GraphQL errors indicator; it does not hide partial data or treat HTTP 200 alone as GraphQL success.

The client sends a JSON envelope with `query`, `variables` and an optional `operationName`. Default headers are `Content-Type: application/json` and `Accept: application/graphql-response+json, application/json;q=0.9`; explicit enabled headers take precedence. GraphQL requests do not automatically follow redirects. Enter the intended endpoint explicitly.

HTTP, curl, fetch and axios previews generate the wire JSON envelope. As with other HTTP requests, previews substitute environment values, but do not execute scripts or resolve Session values. Invalid GraphQL drafts do not produce code previews.

## Current limits

- POST queries and mutations only. No GraphQL subscriptions, including through the separate WebSocket client.
- No automatic schema or introspection requests. No schema import, schema browser, schema-aware autocomplete or local schema validation.
- No multipart uploads, batching, persisted queries or incremental/streaming responses in GraphQL mode.
- Collection import does not convert external GraphQL requests into this editor automatically.

GraphQL makes no background requests and requires no account or cloud service.

<script setup>
import { withBase } from 'vitepress'
</script>
