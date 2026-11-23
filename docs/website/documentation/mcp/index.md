---
title: MCP Quickstart
description: "Connect Claude Code, Cursor, Codex, or VS Code Copilot to your local massCode Markdown vault via MCP to work with snippets, notes, and saved HTTP requests."
---

# MCP Quickstart

Connect **Claude Code**, **Cursor**, **Codex**, or **VS Code Copilot** to your local massCode workspace through Model Context Protocol (MCP).

massCode stores your **code snippets**, **Markdown notes** (with internal `[[...]]` links), and **saved HTTP requests** as local `.md` files in your Markdown Vault, with collection settings kept alongside them in `.state.yaml`. The built-in MCP server connects your coding agent directly to those three spaces across every repository on your computer—without moving your data to a cloud service:

- **Reuse your snippets and linked notes** across projects instead of rewriting helpers or pasting context by hand.
- **Preview and run saved HTTP requests** using your active environment and saved history, while secret values stay stored separately from your synced vault.
- **Save new solutions back to massCode** into organized folders with tags, synced live with the app.

## 1. Enable MCP in massCode

1. Open **Preferences → API** in massCode.
2. Turn on **Enable API integrations**. Reuse your existing token (for example, from [Clipper](/documentation/clipper)), or click **Generate token** and copy it—the full token is shown only once. If a token already exists, the button reads **Replace token**; replacing it immediately invalidates the old token in Clipper and every other connected client.
3. Turn on **Enable MCP access**, then click **Copy** next to **Server URL**. With the default API port, it is `http://127.0.0.1:4321/mcp`.
4. *(Optional)* Turn on **Allow MCP to modify existing items** if you want the agent to update, move, trash, or restore existing records. Reading, creating items and folders, and sending saved HTTP requests work without it.

Keep massCode running while your agent uses MCP. Changing the API port requires an app restart and an updated client URL; toggling MCP access or editing permission takes effect immediately.

## 2. Connect Your Coding Agent

Copy the **Server URL** from **Preferences → API**. If it differs from the URL below, use yours.

::: code-group

```sh [Claude Code]
claude mcp add --transport http --scope user masscode http://127.0.0.1:4321/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

```json [Cursor]
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

```toml [Codex]
[mcp_servers.masscode]
url = "http://127.0.0.1:4321/mcp"
http_headers = { Authorization = "Bearer YOUR_TOKEN" }
```

```json [VS Code Copilot]
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

:::

| Client | Where to put it & check status | Reference |
| --- | --- | --- |
| **Claude Code** | Run in your terminal (`--scope user` makes massCode available in every project). Open Claude Code and run `/mcp` to check the connection. | [Claude Code MCP guide](https://code.claude.com/docs/en/mcp) |
| **Cursor** | Merge into `~/.cursor/mcp.json`, replace `YOUR_TOKEN`, then check the server in Cursor's MCP settings. | [Cursor MCP guide](https://cursor.com/help/customization/mcp) |
| **Codex** | Add to `~/.codex/config.toml`, keep the `Bearer ` prefix (including its space), restart Codex, open a new local task, and run `/mcp` in the CLI. | [Codex MCP guide](https://developers.openai.com/codex/mcp) |
| **VS Code Copilot** | Run **MCP: Open User Configuration** from the Command Palette, merge the config, start the server, enter your token when prompted, and use Copilot agent mode. | [VS Code MCP reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |

Keep your token in user-level local configuration rather than a shared repository. In Codex, if you prefer not to keep the token in `config.toml`, use `bearer_token_env_var = "MASSCODE_API_TOKEN"` (or `codex mcp add masscode --url http://127.0.0.1:4321/mcp --bearer-token-env-var MASSCODE_API_TOKEN`) instead of `http_headers`.

## 3. Verify the Connection

Start a chat in your connected agent and send one read-only prompt:

> List my massCode Notes folders.

If the connection works, the agent calls `list_structure` and returns your Notes folders—or an empty list if you have not created any yet.

## Local-First & Safety by Default

- **Localhost only (`127.0.0.1`):** The MCP server binds only to your machine and rejects unexpected browser origins. Your vault files stay on disk as plain Markdown.
- **Safe permission tiers:** MCP is off by default. Turning on **Enable MCP access** allows reading, creating items and folders, and running saved HTTP requests; modifying, moving, trashing, or restoring existing items stays blocked until you enable **Allow MCP to modify existing items**.
- **No permanent deletion:** MCP can move items to Trash and restore them, but it never permanently deletes snippets, notes, or HTTP requests. Updates and trash operations require the latest `contentRevision` so stale edits fail with `CONFLICT` instead of overwriting newer changes.
- **Protected HTTP secrets:** `preview_http_request` masks values and never runs scripts. `execute_http_request` uses your active environment and substitutes protected secret values for the target server, while those secret values stay stored separately from your synced vault. Scripts run only if you already trusted them in massCode.

::: info Data sent to your model provider
The MCP server runs locally, but any content your agent reads—including snippets, notes, and HTTP response bodies—becomes part of the agent's context and may be sent to its model provider.
:::

## Next Steps

- See **[MCP Workflows](/documentation/mcp/workflows)** for practical cross-space examples combining snippets, linked notes, and HTTP requests, plus a ready-to-use `CLAUDE.md` / `AGENTS.md` rule snippet.
- See **[MCP Reference](/documentation/mcp/reference)** for all 24 tools, naming rules, revision handling, limits, and troubleshooting.
