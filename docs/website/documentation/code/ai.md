---
title: AI Chat
description: "Ask questions about a code fragment using your OpenAI API key or an Ollama or LM Studio server."
---

# AI Chat

Use the AI panel in Code to ask questions about a fragment or selected code. Connect your own OpenAI account, Ollama, or LM Studio. Responses stream into the panel with Markdown formatting, highlighted code blocks, and a copy action for each block. Suggested changes are applied only after you review and confirm them.

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

## Ask About Code

1. Open a snippet and select its fragment.
2. Select the code you want to discuss, or choose the whole fragment as context.
3. Open the AI panel from the editor toolbar.
4. Review the attached context, enter a question, and send it.

The context uses the current editor text, including edits that have not yet been saved. Selected code is not automatically expanded to include the rest of the fragment. Other fragments, descriptions, tags, and files are not attached automatically.

Use **Stop** to interrupt a response. Partial text remains available to read and copy. If the assistant has already prepared a valid edit proposal, stopping its explanation keeps the proposal available for review.

Use **Retry** on the latest failed or interrupted response to try again with the current editor context. This replaces the failed attempt rather than duplicating your question. Text you have started writing in the message box is preserved. Requests are not retried automatically, except for one correction attempt for an invalid edit proposal.

## Apply an Edit

Describe a change in the chat and send it normally, just as you would ask a question. The model uses the `propose_edit` tool to return exact text replacements for the selected code or entire fragment. The model then continues with a normal Markdown answer explaining the proposed changes, showing code and useful examples. Markdown examples are never treated as edits, regardless of how many code blocks the answer contains. If the explanation fails, the validated proposal remains available for review.

When the proposal is ready and generation has finished or been stopped, choose **Review changes**, inspect the diff and choose **Apply changes** or **Reject changes**. Multiple edits are validated and applied together. The editor saves accepted changes normally; use editor Undo to revert them. Subsequent chat messages include the tool calls and whether their proposals were applied, rejected, invalid, or still awaiting review.

Each proposal is bound to the original context snapshot. Every replacement must match exactly once, and replacements cannot overlap. Changed source, another vault, incomplete calls, and invalid arguments prevent application. If a structurally valid proposal contains missing, ambiguous, or overlapping replacements, massCode sends the validation failure back to the same model for one correction attempt. No changes are applied during correction; a valid result still requires your review. No code is changed before confirmation. Exact-match checks protect the application of edits; they do not prove that the proposed code is correct. Review related definitions and calls in the diff. The assistant can only account for code you supplied, so choose the entire fragment when a change affects several parts of it.

Your provider and selected model must support OpenAI-compatible tool calling. A plain text answer does not count as a proposal; use a tool-capable model if no proposal is returned. massCode does not silently interpret Markdown as a fallback.

## Conversations and Privacy

Conversations are kept separately for each fragment during the current app session. Closing the panel preserves the conversation. Switching fragments stops an active response. Reloading or restarting the app clears the conversations, and changing vaults clears them as well.

When a conversation reaches the request size limit, older complete exchanges are left out of the next request and a notice appears in the panel. They remain visible in the chat. The current request and its attached code are not shortened. If the current request itself is too large, select a smaller section.

The configured server receives your messages, the included conversation history, and attached code. A local model running on your computer can process these without sending them to a cloud provider. A local server address alone does not guarantee local processing: Ollama can also serve cloud-backed models. massCode does not automatically switch to a cloud provider when a local server is unavailable.

[MCP](/documentation/mcp) is a separate integration for connecting external AI clients to your vault. AI Chat does not require MCP to be enabled.

## Troubleshooting

- **Server unavailable:** start Ollama or the LM Studio API server and verify the address and port.
- **Model unavailable or unsupported:** check that the selected ID belongs to a chat model available on that server.
- **First response takes time:** a local server may need to load the model before returning text. You can stop the request while it loads.
- **Context is too large:** select a smaller section or start a new conversation. massCode reports the limit instead of silently removing code.
- **Authentication failed:** replace the API key or token in Preferences.
