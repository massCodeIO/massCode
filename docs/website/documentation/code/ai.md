---
title: AI Chat
description: "Chat across Code, Notes and HTTP with explicit context or vault search using OpenAI, Ollama or LM Studio."
---

# AI Chat

Use the shared AI panel in Code, Notes and HTTP to ask questions, attach records, or find information across your vault. Connect your own OpenAI account, Ollama, or LM Studio. Responses stream into the panel with Markdown formatting, highlighted code blocks, and a copy action for each block. Suggested changes are applied only after you review and confirm them.

## Connect a Provider

Open **Preferences → AI assistant** and choose a provider.

| Provider | Connection |
| --- | --- |
| OpenAI | Enter your API key and choose a model that supports Chat Completions. Requests use your provider account and API billing. |
| Ollama | Start Ollama and use its API address, usually `http://localhost:11434/v1`. |
| LM Studio | Start the API server in LM Studio and use its address, usually `http://localhost:1234/v1`. Enter a token if your server requires authentication. |

Click **Save and check connection** to save your connection settings and retrieve available model IDs. Select a chat model, or enter its ID manually, then click **Save**. A successful model-list request confirms that the server is reachable; it does not guarantee that every listed model supports text chat. Embedding models cannot answer chat messages.

The local server address includes the `/v1` suffix. massCode connects to an existing server; download and manage models in Ollama or LM Studio.

API keys are stored on this device using operating-system encryption, outside your vault. They are not included in vault sync. Changing a server address removes the key for that connection; enter a new key explicitly when the new server requires one. If secure storage is unavailable, connections that do not require a key can still be used.

## Choose Context or Search the Vault

Open **AI assistant** from the space rail. The chat stays open when you move between Code, Notes and HTTP. A new chat initially attaches the selected item: the current editor fragment in Code, or the saved record in Notes and HTTP. Remove its chip to chat without it. The automatic context follows the selected item. Removing its chip disables automatic context until you start a new chat. Records added manually through **+** stay pinned.

Use **+** below the message box to search for snippets, notes or saved HTTP requests. Selected records appear as removable chips. Saved records are read when you send the message. In Code, **Open fragment** or **Selection** captures the current editor text, including unsaved edits; that snapshot stays attached when you navigate elsewhere. Remove and reattach it to capture newer edits.

You can send a message without attachments. The assistant can answer directly or search Code, Notes and HTTP, then read records relevant to your question. Search and read activity lists the records it used. Each request has a bounded number of tool rounds and a content-size budget; oversized records are reported rather than silently shortened.

HTTP context is the saved request definition. The assistant does not send requests, execute scripts, read upload files, or resolve environment secrets. Authentication settings and standard credential headers are excluded; literal values elsewhere in saved content are still content you share with the configured provider.

Use **Stop** to interrupt a response. Partial text remains available to read and copy. If the assistant has already prepared a valid edit proposal, stopping its explanation keeps the proposal available for review.

Use **Retry** on the latest failed or interrupted response to try again with the original editor attachment; saved record attachments are read again. This replaces the failed attempt rather than duplicating your question. Text you have started writing in the message box is preserved. Invalid edit proposals receive one correction attempt, which may instead produce a normal answer. A further failure continues without tools. An explicit rejection of tool support by the server can also continue as plain chat.

## Apply an Edit

Attach an open Code fragment or selection, then describe a change and send it normally. Direct application currently supports that editor attachment; records found through vault search and saved Notes/HTTP attachments provide read-only context. The model uses the `propose_edit` tool to return exact text replacements for the selected code or entire fragment. The model then continues with a normal Markdown answer explaining the proposed changes, showing code and useful examples. Markdown examples are never treated as edits, regardless of how many code blocks the answer contains. If the explanation fails, the validated proposal remains available for review.

When the proposal is ready and generation has finished or been stopped, choose **Review changes**, inspect the diff and choose **Apply changes** or **Reject changes**. Multiple edits are validated and applied together. The editor saves accepted changes normally; use editor Undo to revert them. Subsequent chat messages include the tool calls and whether their proposals were applied, rejected, invalid, or still awaiting review.

Each proposal is bound to the original context snapshot. Every replacement must match exactly once, and replacements cannot overlap. Changed source, another vault, incomplete calls, and invalid arguments prevent application. If a structurally valid proposal contains missing, ambiguous, or overlapping replacements, massCode sends the validation failure back to the same model for one correction attempt. No changes are applied during correction; a valid result still requires your review. No code is changed before confirmation. Exact-match checks protect the application of edits; they do not prove that the proposed code is correct. Review related definitions and calls in the diff. Choose the entire fragment when a change affects several parts of it. To apply a proposal after navigating elsewhere, return to the original fragment; it must still match the snapshot.

Your provider and selected model must support OpenAI-compatible tool calling. A plain text answer does not count as a proposal; use a tool-capable model if no proposal is returned. massCode does not silently interpret Markdown as a fallback.

## Conversations and Privacy

One conversation is shared across Code, Notes and HTTP during the current app session. Closing the panel or switching records and spaces preserves the conversation and does not stop generation. New chat clears the conversation and attachments, then re-enables automatic context and selects the current item. Reloading or restarting the app clears the conversation; changing vaults also clears it.

When a conversation reaches the request size limit, older complete exchanges are left out of the next request and a notice appears in the panel. They remain visible in the chat. The current request and its attached code are not shortened. If the current request itself is too large, select a smaller section.

The configured server receives your messages, the included conversation history, attached context, and records read through vault tools. A local model running on your computer can process these without sending them to a cloud provider. A local server address alone does not guarantee local processing: Ollama can also serve cloud-backed models. massCode does not automatically switch to a cloud provider when a local server is unavailable.

[MCP](/documentation/mcp) is a separate integration for connecting external AI clients to your vault. AI Chat does not require MCP to be enabled.

## Troubleshooting

- **Server unavailable:** start Ollama or the LM Studio API server and verify the address and port.
- **Model unavailable or unsupported:** check that the selected ID belongs to a chat model available on that server.
- **First response takes time:** a local server may need to load the model before returning text. You can stop the request while it loads.
- **Context is too large:** select a smaller section or start a new conversation. massCode reports the limit instead of silently removing code.
- **Authentication failed:** replace the API key or token in Preferences.
