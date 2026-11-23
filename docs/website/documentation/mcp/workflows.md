---
title: MCP Workflows
description: "Practical workflows combining massCode snippets, Markdown notes, saved HTTP requests, and coding agents through MCP."
---

# MCP Workflows

The real value of massCode with MCP is connecting **snippets**, **linked Markdown notes**, and **saved HTTP requests** inside one local vault. Instead of copying code, docs, and API examples into every chat, your coding agent reads what you already trust and writes new knowledge back.

The workflows below are ordered from zero-setup (`Snippets + Notes`) to full API and vault maintenance workflows.

## 1. Reuse a Proven Snippet & Link It in Project Notes

**Spaces:** Code + Notes

When you need a helper you already wrote in another repository—such as a retry wrapper, SQL query, or config template—pull it directly from massCode, adapt it to the current project, and record the link in your project note.

**Prerequisite:** Reading and saving new items work with default MCP permissions. Updating an existing note requires **Allow MCP to modify existing items** in **Preferences → API**.

**Prompt:**

> Search my massCode snippets for my TypeScript retry helper and use it in `src/api/client.ts`. If we improve it here, save the updated helper in my `Utils` folder with tags `typescript` and `retry`, and link it from my `Backend Architecture` note.

**What happens in massCode:**

1. The agent searches your snippet library, reads the matching snippet, and adapts it to your repository.
2. If you ask it to save an improved version, it checks your Code folders and tags so the new snippet lands in the right place without duplicating tags.
3. It reads your project note, gets its current `contentRevision`, and adds a stable `[[snippet:ID|Label]]` link that keeps working even if you rename the snippet later.

**Tools used:** `search` → `get_item` → `list_structure` → `create_snippet` → `get_item` + `update_note`.

## 2. Debug & Reproduce an API Bug End-to-End

**Spaces:** HTTP + Notes + Code

When an API integration breaks, keep your agent grounded in the real request and response instead of guessing payloads or pasting cURL commands.

**Prerequisite:** A saved HTTP request and an active environment configured in massCode.

**Prompt:**

> Find the `Create order` request in my `Payments API` HTTP collection. Preview its settings first, then send it against the active environment (or inspect the latest saved response if it was already run). Compare the error with my `Payments troubleshooting` note, fix the payload builder in this repo, and save the working error parser as a snippet in `Payments`.

**What happens in massCode:**

1. The agent locates the collection and request, then inspects its masked URL, effective auth type, and script trust with `preview_http_request` before sending anything.
2. It runs the request with your active environment and protected secrets—or reads a redacted snapshot from execution history without hitting the server again.
3. It checks your related note for known caveats, fixes the code in your repo, and saves the reusable parser back into your snippet library.

**Tools used:** `list_http_collections` / `list_http_requests` → `preview_http_request` → `execute_http_request` (or `list_http_history` → `get_http_history`) → `search` / `get_item` → `create_snippet`.

## 3. Document & Verify a New API Endpoint

**Spaces:** Repo → HTTP + Notes

Right after implementing a new route in your codebase, have your agent add a reusable request to your existing HTTP collection, verify it against your running server, and create an endpoint note linked to the saved request. This entire workflow works with default MCP permissions (no editing of existing items required).

**Prerequisite:** An existing HTTP collection in massCode with authorization configured (if needed) and an active environment defining <code v-pre>{{baseUrl}}</code>. If you need a brand-new collection first, `create_http_collection` creates an empty collection by name only—configure its authorization and environment in massCode before sending.

**Prompt:**

> Look at the new `POST /v1/invoices` handler I just added. Save a matching HTTP request in my `Billing API` collection using <code v-pre>{{baseUrl}}/v1/invoices</code>, preview it, run it once to verify the response, and create a new `Invoices API` note in my `API Docs` folder linked to that saved request.

**What happens in massCode:**

1. The agent finds the `Billing API` collection ID and saves the request inside it so it automatically inherits the collection's authorization.
2. It previews the masked request settings, sends the request against the active environment, and verifies the live response.
3. It creates a new Markdown note documenting the endpoint and embeds a stable `[[http-request:ID|Label]]` link pointing straight to the saved request.

**Tools used:** `list_http_collections` → `create_http_request` → `preview_http_request` → `execute_http_request` → `create_note`.

## 4. Load Connected Context Before Starting a Feature

**Spaces:** Notes Graph → Code + HTTP

Before implementing a feature, let your agent follow the links around a project or architecture note to pull related snippets, HTTP requests, and still-unwritten planned items.

**Prompt:**

> Find my `Auth Redesign` note in massCode, check its incoming and outgoing links, read the linked snippets and HTTP requests, and list any planned items that have not been created yet before we plan the implementation.

**What happens in massCode:**

1. The agent locates and reads the hub note.
2. It calls `get_note_links` to retrieve `incoming` backlinks and `outgoing` links (`resolved`, `missing`, and `planned`).
3. It reads `resolved` targets with `get_item` for full context. Because `planned` links have `id: null`, the agent reports them as open items rather than trying to fetch them.

**Tools used:** `search` → `get_item` → `get_note_links` → `get_item` (for `resolved` targets).

## 5. Triage Your Inbox Safely

**Spaces:** Notes / Code Organization

Clean up unfiled notes or snippets accumulated during the week without risking permanent data loss.

**Prerequisite:** Turn on **Allow MCP to modify existing items** in **Preferences → API** (creating folders works without it, but moving items, updating tags, trashing, and restoring require it).

**Prompt:**

> List the notes in my massCode Inbox. Create an `Ops` folder if it does not exist, move the deployment notes there, tag them `ops` and `release`, and move the two empty draft notes to Trash.

**What happens in massCode:**

1. The agent lists Inbox items and checks your existing folder tree, creating any missing folders.
2. It moves items into the target folder in bulk with `move_items` (which updates only `folderId`).
3. To update tags or move obsolete drafts to Trash, it reads each item with `get_item` for its latest `contentRevision`, then calls `update_note` / `update_snippet` or `trash_item`. Trashed items are never permanently deleted and can be restored with `restore_item` or from Trash in massCode.

**Tools used:** `list_items` (`folderId: "inbox"`) → `list_structure` → `create_folder` → `move_items`; for tags and Trash: `get_item` → `update_note` / `update_snippet` / `trash_item` (and `restore_item` if needed).

::: info Large library reorganizations
For sweeping reorganizations across dozens of folders, use the built-in massCode **[AI Assistant](/documentation/ai#apply-preview-and-undo-changes)** instead: it lets you preview vault changes before applying them and undo completed edits.
:::

## Teach Your Agent When to Use massCode

Add a short block like this to your global `~/.claude/CLAUDE.md`, `AGENTS.md`, or Cursor User Rules so your agent knows when to reach for massCode automatically:

```markdown
## massCode Workspace (MCP)

- Before writing common helpers, queries, or cURL commands from scratch, search my local massCode vault for existing snippets, notes, or saved HTTP requests.
- Always call `preview_http_request` before `execute_http_request`, and ask before sending requests that mutate external data.
- When saving a new snippet or note, check `list_structure` first to place it in an existing folder with consistent tags.
- When linking items inside notes, prefer stable ID links (`[[note:ID|Label]]`, `[[snippet:ID|Label]]`, `[[http-request:ID|Label]]`).
```
