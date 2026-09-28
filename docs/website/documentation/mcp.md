---
title: MCP
description: "Connect your coding agent to massCode to work with snippets, notes, HTTP collections and requests, preview and send requests, and inspect execution history."
---

# MCP

<AppVersion text=">=6.0" />

Connect your coding agent to massCode through Model Context Protocol (MCP) to work with snippets, notes, and saved HTTP requests.

Try asking: "Find my retry helper and use it here," or "Save this solution as a TypeScript snippet."

## Enable Access

1. Open **Preferences → API** in massCode.
2. Enable **API integrations**.
3. Reuse a saved [Clipper](/documentation/clipper) token, or click **Generate token** and save it. The full token is shown only once.
4. Enable **MCP access**.
5. Copy the **Server URL**. With the default API port, it is `http://127.0.0.1:4321/mcp`.

Keep massCode running. Changing the API port requires an app restart and an updated client URL; toggling MCP access takes effect immediately.

MCP is off by default. Clients with your token can access the active vault and use all tools listed below. Generating a replacement token invalidates the old one in every client, including the Clipper.

The server listens only on your computer. Returned content, including HTTP responses that may contain sensitive data, becomes part of the agent's context and may be sent to its model provider.

## Codex

Add the following to your user-level `~/.codex/config.toml`, keeping any existing settings:

```toml
[mcp_servers.masscode]
url = "http://127.0.0.1:4321/mcp"
http_headers = { Authorization = "Bearer YOUR_TOKEN" }
```

Replace only `YOUR_TOKEN` with your Integration API token. Keep the `Bearer ` prefix, including its space. Change the port if needed. Keep this token in your local configuration rather than a shared repository.

Restart Codex and open a new local task. In the CLI, use `/mcp` to check the active server. See the [Codex MCP guide](https://developers.openai.com/codex/mcp) for configuration options.

## Claude Code

Replace `YOUR_TOKEN` with your token and change the port if necessary:

```sh
claude mcp add --transport http masscode http://127.0.0.1:4321/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

Open Claude Code and use `/mcp` to check the connection. See the [Claude Code MCP guide](https://code.claude.com/docs/en/mcp) for configuration scopes.

## Cursor

Add this server to your user-level `~/.cursor/mcp.json`, merging it with any existing servers:

```json
{
  "mcpServers": {
    "masscode": {
      "url": "http://127.0.0.1:4321/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

Replace `YOUR_TOKEN`, then check the server in Cursor's MCP settings. Keep the token in your local configuration rather than a shared repository. See the [Cursor MCP guide](https://cursor.com/help/customization/mcp).

## VS Code / Copilot

Run **MCP: Open User Configuration** from the Command Palette. Merge this server and input with your existing configuration:

```json
{
  "servers": {
    "masscode": {
      "type": "http",
      "url": "http://127.0.0.1:4321/mcp",
      "headers": {
        "Authorization": "Bearer ${input:masscode-token}"
      }
    }
  },
  "inputs": [
    {
      "id": "masscode-token",
      "type": "promptString",
      "description": "massCode Integration API token",
      "password": true
    }
  ]
}
```

Start the server and enter your token when prompted. Use the tools from Copilot's agent mode. See the [VS Code MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

## Available Tools

| Tool | What it does |
| --- | --- |
| `search` | Searches snippets and notes by name and content, and HTTP requests by name or URL. |
| `get_item` | Reads an item by type and ID. |
| `create_snippet` | Saves a snippet with one code fragment to Code Inbox. |
| `create_note` | Saves a Markdown note to Notes Inbox. |
| `list_http_collections` | Lists collection and folder IDs, names, and hierarchy. |
| `list_http_requests` | Lists request metadata across collections, in Inbox, or in a folder. |
| `create_http_collection` | Creates a root HTTP collection. |
| `create_http_request` | Saves an HTTP request without sending it. |
| `update_http_request` | Edits or moves a saved request with revision checking. |
| `preview_http_request` | Shows masked request settings without sending it. |
| `execute_http_request` | Sends a saved request using the active environment. |
| `list_http_history` | Lists saved execution metadata. |
| `get_http_history` | Reads a saved, redacted history snapshot. |

`search`, `list_http_requests`, and `list_http_history` support `offset` and `limit`: 20 results by default, up to 100. Follow `nextOffset` while `hasMore` is true. Search also accepts a `type` filter: `snippet`, `note`, `http_request`, or `all`. Use `get_item` with both type and ID to read an item; IDs can overlap between types.

New snippets default to `plain_text`. Creating an item never overwrites an existing item with the same name. MCP can update saved HTTP requests but cannot delete items or edit environments.

## Organizing HTTP Requests

Use `list_http_collections` to find a collection or nested folder. Create a root collection with `create_http_collection`, then pass its ID as `folderId` to `create_http_request`. Omit `folderId` or pass `null` to save in **Inbox**. New requests in a collection inherit its authorization.

For `list_http_requests`, `folderId` selects what to list:

| Value | Requests returned |
| --- | --- |
| Omitted | All HTTP requests, including those in nested folders. |
| `null` | Inbox. |
| Collection or folder ID | Direct requests only. |

All modes exclude trash and WebSocket requests. Results are ordered by most recently updated first, then ascending ID.

For example: "Find my Example API collection, create it if needed, and save a GET request for https://example.com/users there."

## Updating Saved HTTP Requests

Read a request with `get_item`, then pass its `contentRevision` as `expectedRevision` to `update_http_request`, together with its `id` and a nonempty `patch`.

You can change `name`, `folderId`, `method`, `url`, `headers`, `query`, text `bodyType`, `body`, `description`, and `auth`. Omitted fields stay unchanged; arrays replace the existing arrays. The response returns the saved name, folder, and new revision.

Moving a request preserves its auth setting. Set `auth` to `{ "type": "inherit" }` to inherit the destination's authorization, or `{ "type": "none" }` to disable it. Bearer, basic, and API-key auth are also supported.

A stale revision returns `CONFLICT` without applying the patch. Read the latest version and reconcile changes before retrying. The app likewise preserves an unsaved draft and reports a conflict if MCP changed its saved version.

For example: "Move List users from HTTP Inbox to Example API and inherit the collection authorization."

## Sending HTTP Requests

Inspect a saved request with `preview_http_request`, then use `execute_http_request` to send it. Preview shows a masked URL, active environment, effective auth type, body length, script trust, and transport limits. It describes settings before scripts and transport processing; it does not send traffic or run scripts.

Execution uses the active environment, inherited collection settings, cookies, protected secrets, and Session variables. Scripts must already be trusted in massCode; MCP cannot grant trust. Review requests that change server data before sending them.

Only one request or collection run can execute at a time. If execution fails or its result is unavailable, inspect history before retrying: the server may already have processed the request.

## Reading HTTP History

Use the returned `historyId` with `get_http_history`, or find an entry with `list_http_history`, optionally filtered by `requestId`. Entries are ordered by execution time, then ID, both descending.

Snapshots are redacted and do not contain a complete network capture. Missing or expired snapshots return `HISTORY_SNAPSHOT_UNAVAILABLE`. A `null` history ID means history was disabled, unavailable, or could not be saved; it does not change the execution outcome or prove that the server never received the request.

For example: "Show the latest saved response for List users without sending it again."

## Limits

| Operation | Limit |
| --- | --- |
| Create, read, or update content | 256 KiB in UTF-8. Reading a snippet counts all fragments; HTTP requests count body plus description. |
| MCP request payload or tool result | 2 MiB, including metadata in results. |
| HTTP execution | 60 seconds and 256 KiB of response body. Capped bodies are marked `truncated`; binary bodies are omitted. |

Oversized saved content and tool results are rejected. Reduce the page size for oversized lists; inspect oversized history snapshots in the app.

MCP supports `none`, `json`, `graphql`, `text`, and `form-urlencoded` request bodies. It cannot edit runtime rules or trashed requests, connect WebSockets, or upload local files. Configure unsupported settings in massCode.

## Troubleshooting

- **Cannot connect:** keep massCode running and verify the port. The client must run on the same computer; a remote container cannot reach your desktop through its own loopback address.
- **Access denied:** enable both API integrations and MCP access, and check that the client uses the latest token.
- **Cloud file unavailable:** download the item through your sync provider and retry.
- **Partial creation:** `PARTIAL_CREATE` includes the created item's ID. Inspect it before retrying; another creation may produce a duplicate.
