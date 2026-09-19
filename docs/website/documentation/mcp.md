---
title: MCP
description: "Connect Codex, Claude Code, Cursor, or VS Code Copilot to your local massCode vault to find, read, and save snippets and notes."
---

# MCP

<AppVersion text=">=5.13" />

Connect your coding agent to massCode through Model Context Protocol (MCP). The agent can search your snippets and notes, read a matching item, and save new code or Markdown to your Inbox.

Try asking: "Find my existing retry helper in massCode and use it here," or "Save this solution as a TypeScript snippet in massCode."

## Enable Access

1. Open **Preferences → API** in massCode.
2. Enable **API integrations**.
3. Click **Generate token** and copy the token. The full token is shown only after generation. If you already saved your token for the Clipper, you can reuse it.
4. Enable **MCP access**.
5. Copy the **Server URL**. With the default API port, it is `http://127.0.0.1:4321/mcp`.

Keep massCode running while using the integration. Changing the API port requires an app restart and an updated URL in your client. Enabling or disabling MCP takes effect without restarting.

MCP is off by default. Enabling it lets clients holding your Integration API token read all non-trashed snippets and notes in the active vault and create new ones. The same token still works with the [Clipper](/documentation/clipper). Generating a replacement token invalidates the old token in every client.

The server listens only on your computer. Content returned to an agent becomes part of that agent's context and may be sent to its model provider.

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
| `search` | Searches snippet and note names, descriptions, and content. Returns compact metadata and item IDs. |
| `get_item` | Reads a note's Markdown or a snippet's fragments using its type and ID. |
| `create_snippet` | Saves a named snippet with one code fragment and an optional language to Code Inbox. |
| `create_note` | Saves a named Markdown note to Notes Inbox. |

Search supports a `type` filter (`snippet`, `note`, or `all`), `offset`, and `limit`. It returns 20 results by default, up to 100 per call. Use `get_item` to retrieve the content of a result. A snippet and a note can have the same ID, so pass both the item type and ID.

New snippets use `plain_text` unless the agent specifies a language. Existing items are not overwritten when a name conflicts. Tools do not update or delete items, execute HTTP requests, or access HTTP environments.

## Troubleshooting

- **Cannot connect:** keep massCode running, verify the port, and use a client running on the same computer. A client in a remote container or remote workspace cannot reach your desktop through its own loopback address.
- **Access denied:** enable both API integrations and MCP access, and check that the client uses the latest token. To stop MCP access while keeping the Clipper working, turn off only **MCP access**.
- **Cloud file unavailable:** download the item through your sync provider and retry. massCode reports unavailable content rather than returning an empty document.
- **Content too large:** Creating and reading an item supports up to 256 KiB of UTF-8 content, counted before JSON escaping. For snippets, reading counts the combined content of all fragments. Separately, the HTTP request body and the JSON text of a tool result (including metadata) each have a 2 MiB limit. The result limit excludes the MCP response envelope. Oversized content or metadata is rejected rather than silently shortened. If a search result is too large, reduce its `limit`; a single oversized result still returns an error.
- **Partial creation:** if a tool reports `PARTIAL_CREATE`, check the returned item ID in massCode before trying again. The item was created, but a later save step failed; retrying may create a duplicate.
