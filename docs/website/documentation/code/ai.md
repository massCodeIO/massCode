---
title: AI Chat
description: "Ask questions about a code fragment using your OpenAI API key or an Ollama or LM Studio server."
---

# AI Chat

Use the AI panel in Code to ask questions about a fragment or selected code. Connect your own OpenAI account, Ollama, or LM Studio. Responses appear in the panel and can be copied; they do not change your snippets automatically.

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

Use **Stop** to interrupt a response. Partial text remains available to read and copy. Failed or interrupted requests are not retried automatically.

## Conversations and Privacy

Conversations are kept separately for each fragment during the current app session. Closing the panel preserves the conversation. Switching fragments stops an active response. Reloading or restarting the app clears the conversations, and changing vaults clears them as well.

The configured server receives your messages, conversation history, and attached code. A local model running on your computer can process these without sending them to a cloud provider. A local server address alone does not guarantee local processing: Ollama can also serve cloud-backed models. massCode does not automatically switch to a cloud provider when a local server is unavailable.

[MCP](/documentation/mcp) is a separate integration for connecting external AI clients to your vault. AI Chat does not require MCP to be enabled.

## Troubleshooting

- **Server unavailable:** start Ollama or the LM Studio API server and verify the address and port.
- **Model unavailable or unsupported:** check that the selected ID belongs to a chat model available on that server.
- **First response takes time:** a local server may need to load the model before returning text. You can stop the request while it loads.
- **Context is too large:** select a smaller section or start a new conversation. massCode reports the limit instead of silently removing code.
- **Authentication failed:** replace the API key or token in Preferences.
