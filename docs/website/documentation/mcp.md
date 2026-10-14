---
title: MCP
description: "Connect your coding agent to massCode to create, organize, and update snippets, notes, HTTP collections and requests, preview and send requests, and inspect execution history."
---

# MCP

Connect your coding agent to massCode through Model Context Protocol (MCP) to work with snippets, notes, and saved HTTP requests.

Try asking: "Find my retry helper and use it here," "Save this solution as a TypeScript snippet," or "Move my server notes into a Servers folder."

## Enable Access

1. Open **Preferences → API** in massCode.
2. Enable **API integrations**.
3. Reuse a saved [Clipper](/documentation/clipper) token, or click **Generate token** and save it. The full token is shown only once.
4. Enable **MCP access**.
5. Optionally enable **Allow MCP to modify existing items**. It is off by default and is required by `update_note`, `update_snippet`, `update_http_request`, `trash_item`, `update_folder`, `delete_folder`, `move_items`, and `restore_item`. Reading and creating items and folders work without it.
6. Copy the **Server URL**. With the default API port, it is `http://127.0.0.1:4321/mcp`.

Keep massCode running. Changing the API port requires an app restart and an updated client URL; toggling MCP access or editing permission takes effect immediately.

MCP is off by default. Clients with your token can access the active vault and use all tools listed below, except editing tools while **Allow MCP to modify existing items** is off. Generating a replacement token invalidates the old one in every client, including the Clipper.

The server listens only on your computer. Returned content, including HTTP responses that may contain sensitive data, becomes part of the agent's context and may be sent to its model provider.

## Claude Code

Replace `YOUR_TOKEN` with your token and change the port if necessary:

```sh
claude mcp add --transport http masscode http://127.0.0.1:4321/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

Open Claude Code and use `/mcp` to check the connection. See the [Claude Code MCP guide](https://code.claude.com/docs/en/mcp) for configuration scopes.

## Codex

Add the following to your user-level `~/.codex/config.toml`, keeping any existing settings:

```toml
[mcp_servers.masscode]
url = "http://127.0.0.1:4321/mcp"
http_headers = { Authorization = "Bearer YOUR_TOKEN" }
```

Replace only `YOUR_TOKEN` with your Integration API token. Keep the `Bearer ` prefix, including its space. Change the port if needed. Keep this token in your local configuration rather than a shared repository.

Restart Codex and open a new local task. In the CLI, use `/mcp` to check the active server. See the [Codex MCP guide](https://developers.openai.com/codex/mcp) for configuration options.

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
| `get_item` | Reads an item by type and ID, including its `contentRevision`. |
| `list_structure` | Lists folders and tags of the Code or Notes space. |
| `create_snippet` | Saves a snippet with one code fragment, optionally in a folder and with tags. |
| `create_note` | Saves a Markdown note, optionally in a folder and with tags. |
| `update_snippet` | Renames, moves, retags, or edits one fragment of a snippet with revision checking. |
| `update_note` | Renames, moves, retags, or replaces the content of a note with revision checking. |
| `trash_item` | Moves a snippet, note, or saved HTTP request to Trash with revision checking. |
| `get_note_links` | Lists a note's outgoing wiki links and the notes that link to it. |
| `list_items` | Lists notes or snippets in a folder, in Inbox, with a tag, or in Trash. |
| `create_folder` | Creates a folder in the Code or Notes space. |
| `update_folder` | Renames a folder or moves it under another parent. |
| `delete_folder` | Deletes an empty folder. |
| `move_items` | Moves up to 100 notes or snippets into a folder or Inbox. |
| `restore_item` | Restores a snippet, note, or saved HTTP request from Trash to Inbox. |
| `list_http_collections` | Lists collection and folder IDs, names, and hierarchy. |
| `list_http_requests` | Lists request metadata across collections, in Inbox, in a folder, or in Trash. |
| `create_http_collection` | Creates a root HTTP collection. |
| `create_http_request` | Saves an HTTP request without sending it. |
| `update_http_request` | Edits or moves a saved request with revision checking. |
| `preview_http_request` | Shows masked request settings without sending it. |
| `execute_http_request` | Sends a saved request using the active environment. |
| `list_http_history` | Lists saved execution metadata. |
| `get_http_history` | Reads a saved, redacted history snapshot. |

`search`, `list_items`, `list_http_requests`, and `list_http_history` support `offset` and `limit`: 20 results by default, up to 100. Follow `nextOffset` while `hasMore` is true. Search also accepts a `type` filter: `snippet`, `note`, `http_request`, or `all`. Use `get_item` with both type and ID to read an item; IDs can overlap between types.

New snippets default to `plain_text`. Creating an item never overwrites an existing item with the same name. MCP can update snippets, notes, and saved HTTP requests, move them to Trash, and restore them, but it never deletes items permanently and cannot edit environments. It deletes only empty folders.

### Item Names

Names of snippets, notes, collections, and requests are also vault file names. They cannot contain `#`, `<`, `>`, `:`, `"`, `/`, `\`, `[`, `]`, `^`, `|`, `?`, `*`, or control characters; `#`, `[`, `]`, `^`, and `|` are also reserved by wiki-link syntax. Names cannot start or end with a dot, and Windows reserved names such as `CON`, `NUL`, or `COM1` are not allowed.

An invalid name returns `INVALID_NAME` with a `reason`: `empty`, `leadingDot`, `invalidChars` (with the found `invalidChars`), `trailingDot`, or `windowsReserved`.

## Organizing Notes and Snippets

Use `list_structure` with `space` set to `code` or `notes` to get folder IDs, their `parentId`, and existing tags. Code and Notes have separate folders and tags.

Pass `folderId` to `create_snippet` or `create_note` to save into a folder; omit it or pass `null` to save in **Inbox**. Pass `tags` as a list of names: existing tags are matched case-insensitively and missing tags are created. The response returns the saved name, folder, tags, `createdTags`, and `contentRevision`.

For example: "Save this helper as a snippet in my Utils folder with the tags typescript and retry."

### Folders and Bulk Moves

- `list_items` lists notes (`notes`) or snippets (`code`) as metadata without content, ordered by ascending ID. Pass a `folderId` for the direct items of a folder or `inbox` for items without a folder. `tag` matches a tag name case-insensitively. Set `status` to `trash` to list Trash; items in Trash usually have no folder.
- `create_folder` creates a folder at the root or, with `parentId`, inside another folder. It works without **Allow MCP to modify existing items**. Folder names follow the [item name rules](#item-names) and must be unique among siblings, ignoring case.
- `update_folder` renames a folder, moves it with `parentId`, or both; `parentId` set to `null` moves it to the root. A folder cannot move into itself or its own subfolders. When the new parent already has a folder with the same name, the moved folder gets an available name; the response returns the actual name.
- `delete_folder` deletes only an empty folder. Move or trash its notes, snippets, and subfolders first. Items already in Trash do not block deletion and stay in Trash. Files in the folder's directory that massCode does not manage, such as files added by other apps, also block deletion. While massCode is still syncing the vault, the tool returns `VAULT_HYDRATING`; retry later.
- `move_items` moves up to 100 notes or snippets into one folder; `folderId` set to `null` moves them to **Inbox**. Each ID gets its own result: `ok` with the actual name, or an `error` code. An item with a conflicting name is saved under an available name. Moving notes rewrites `[[Title]]` links to them in other notes.

Updating, moving, and deleting folders and moving items require **Allow MCP to modify existing items**.

For a large library reorganization, use the built-in massCode [AI Assistant](/documentation/ai#apply-preview-and-undo-changes) instead: you can review its changes before applying them and undo them afterward.

For example: "Create an Archive folder in Notes and move all notes tagged old there."

## Updating Notes and Snippets

Updating requires **Allow MCP to modify existing items**. Read the item with `get_item`, then pass its `contentRevision` as `expectedRevision` to `update_note` or `update_snippet`, together with its `id` and a nonempty `patch`:

- `name` renames the item.
- `folderId` moves it to a folder; `null` moves it to **Inbox**.
- `tags` replaces the whole tag set and creates missing tags.
- `content` replaces the Markdown body of a note.
- `fragment` edits one snippet fragment: its `content`, `language`, or `label`. Pass `fragment.contentId` from `get_item` when the snippet has several fragments.

Omitted fields stay unchanged. The response returns the actual name, folder, tags, and new revision. Moving an item into a folder that already has an item with the same name saves it under an available name, such as `Name 1`.

Renaming or moving a note rewrites `[[Title]]` links in other notes, so their revisions change. `[[note:ID]]` links stay valid without changes. Renaming a snippet does not update `[[Title]]` links in notes.

A stale revision returns `CONFLICT` without applying the patch. If a step fails after part of the patch was saved, `PARTIAL_UPDATE` lists the `applied` steps, the `failed` step, tags created so far in `createdTags`, and the current revision. Read the item again before retrying. When the `content` step fails, the response also includes `persisted: false`: the content change may not be saved, even if massCode already shows it. Resend the same content or fragment patch with the returned `contentRevision`.

::: warning Open items
If the note or snippet is open in massCode with unsaved typing, the app autosave may overwrite the MCP edit. Ask the agent to read the item again to verify the result.
:::

For example: "Move my Deploy checklist note to Ops, tag it release, and add a rollback step."

## Moving Items to Trash

`trash_item` moves a snippet, note, or saved HTTP request to Trash and removes it from its folder. Like updates, it requires **Allow MCP to modify existing items** and the latest `contentRevision` as `expectedRevision`. MCP never deletes items permanently.

`restore_item` returns a trashed item to **Inbox** and responds with its actual name and new `contentRevision`. Find trashed notes and snippets with `list_items`, and trashed HTTP requests with `list_http_requests`, both with `status` set to `trash`. If reading the item back fails after restoring, the response has `contentRevision` set to `null`: read it with `get_item`. It also requires **Allow MCP to modify existing items**. You can also restore items from Trash in massCode.

## Working with Links

`get_note_links` returns the wiki links of a note:

- `outgoing`: unique links in its content with `type`, `id`, `label`, `raw`, and a `status` of `resolved`, `missing`, or `planned`.
- `incoming`: notes outside Trash that link to it by title, folder path, or ID.

Notes whose content is not downloaded yet are skipped and counted in `skippedPendingNotes`.

When an agent writes links to existing items, prefer `[[note:ID|Label]]`, `[[snippet:ID|Label]]`, or `[[http-request:ID|Label]]`. Unlike `[[Title]]`, they keep working after renames.

## Organizing HTTP Requests

Use `list_http_collections` to find a collection or nested folder. Create a root collection with `create_http_collection`, then pass its ID as `folderId` to `create_http_request`. Omit `folderId` or pass `null` to save in **Inbox**. New requests in a collection inherit its authorization.

For `list_http_requests`, `folderId` selects what to list:

| Value | Requests returned |
| --- | --- |
| Omitted | All HTTP requests, including those in nested folders. |
| `null` | Inbox. |
| Collection or folder ID | Direct requests only. |

All modes exclude WebSocket requests. Set `status` to `trash` to list trashed requests instead of active ones, for example to find an ID for `restore_item`. Results are ordered by most recently updated first, then ascending ID.

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
| Create, read, or update content | 256 KiB in UTF-8. Snippets count all fragments; HTTP requests count body plus description. |
| Tags per create or update | 50 names, up to 255 characters each. |
| MCP request payload or tool result | 2 MiB, including metadata in results. |
| HTTP execution | 60 seconds and 256 KiB of response body. Capped bodies are marked `truncated`; binary bodies are omitted. |

Oversized saved content and tool results are rejected. Reduce the page size for oversized lists; inspect oversized history snapshots in the app.

MCP supports `none`, `json`, `graphql`, `text`, and `form-urlencoded` request bodies. It cannot edit runtime rules or trashed requests, connect WebSockets, or upload local files. Configure unsupported settings in massCode.

## Troubleshooting

- **Cannot connect:** keep massCode running and verify the port. The client must run on the same computer; a remote container cannot reach your desktop through its own loopback address.
- **Access denied:** enable both API integrations and MCP access, and check that the client uses the latest token.
- **Editing disabled:** `EDITING_DISABLED` means **Allow MCP to modify existing items** is off. Enable it in **Preferences → API** to update or move items, rename, move, or delete folders, move items to Trash, or restore them.
- **Invalid name:** check the `reason` in `INVALID_NAME` and see [Item Names](#item-names).
- **Reserved folder name:** `RESERVED_NAME` means massCode uses this name for its own folders, such as `inbox` or `trash` at the root. Choose another name.
- **Folder not empty:** `FOLDER_NOT_EMPTY` reports the number of `subfolders` and active `items`. Move or trash them, then delete the folder again. A `files` count means the folder's directory contains files that massCode does not manage: move or remove them outside massCode first.
- **Invalid parent:** `INVALID_PARENT` means the folder would move into itself or one of its subfolders.
- **Not in Trash:** `NOT_IN_TRASH` means the item passed to `restore_item` is already active.
- **Cloud file unavailable:** download the item through your sync provider and retry.
- **Partial creation:** `PARTIAL_CREATE` includes the created item's ID and any tags created in `createdTags`. Inspect it before retrying; another creation may produce a duplicate.
- **Partial update:** `PARTIAL_UPDATE` means some changes may have been saved. Read the item again with `get_item` and retry only the remaining changes; if `persisted` is `false`, resend the content or fragment patch with the returned `contentRevision`.
