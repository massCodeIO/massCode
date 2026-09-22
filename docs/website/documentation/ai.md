---
title: AI Assistant
description: "Edit and organize snippets and notes, manage HTTP workflows, and search your vault with a connected AI provider or local model."
---

# AI Assistant

Use the shared AI panel in Code, Notes and HTTP to ask questions, edit and organize records, manage HTTP workflows, or find information across your vault. Connect your own provider account or a local model server. Responses stream into the panel with Markdown formatting, highlighted code blocks, and a copy action for each block. Changes to existing records require review and confirmation. Explicitly requested new records are created immediately, with clickable links in the answer.

## Connect a Provider

Open **Preferences → AI assistant** and choose a provider.

| Provider | Connection |
| --- | --- |
| OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, xAI | Enter an API key from the selected provider and choose an available chat model. Requests use that provider’s API account and billing. |
| Ollama | Start Ollama and use its API address, usually `http://localhost:11434/v1`. |
| LM Studio | Start the API server in LM Studio and use its address, usually `http://localhost:1234/v1`. Enter an API key if your server requires authentication. |

Click **Save and check connection** to save your settings and load available models. Choose one from the selector, or enter a model ID manually, then click **Save and check connection** again to save the selection. A notification reports the result.

The loaded model list is kept with the provider’s settings and remains available when you reopen Preferences. Changing the key or server address clears that list until the next successful check. The selector stays visible when no models have been loaded.

A successful connection check confirms access to the model list; it does not verify chat or tool support for every model. Choose a text chat model. Search and edit proposals also require tool calling support.

The local server address includes the `/v1` suffix. massCode connects to an existing server; download and manage models in Ollama or LM Studio.

Saved keys appear as a masked preview. Use **Replace key** or **Remove key**, then **Save and check connection** to save the change.

API keys are stored on this device using operating-system encryption, outside your vault. They are not included in vault sync. Changing a server address removes the key for that connection; enter a new key explicitly when the new server requires one. If secure storage is unavailable, connections that do not require a key can still be used.

## Custom Instructions

In **Preferences → AI assistant → Custom instructions**, describe your preferred language, style or response format. For example:

> Always answer in Russian. Keep explanations concise and include examples when useful.

Click **Save and check connection** to save. These preferences apply across chats and providers and remain after restarting the app. Clear the field and save to remove them. Changes to existing records still require review and confirmation.

## Choose Context or Search the Vault

Open **AI assistant** from the space rail, choose **View → AI assistant**, or press <kbd>Cmd+L</kbd> on macOS / <kbd>Ctrl+L</kbd> on Windows and Linux. In Notes and HTTP, the assistant appears as a tab in the inspector panel. The chat stays open when you move between Code, Notes and HTTP. A new chat initially attaches the selected item: the current editor content in Code and Notes, or the saved record in HTTP. Remove its chip to chat without it. The automatic context follows the selected item. Removing its chip disables automatic context until you start a new chat. Records added manually through **+** stay pinned.

Use **+** below the message box to search for snippets, notes or saved HTTP requests. Selected records appear as removable chips. Saved records are read when you send the message. In Code, **Open fragment** or **Selection** captures the current editor text, including unsaved edits. In Notes, use **Open note** or **Selection**. That snapshot stays attached when you navigate elsewhere. Remove and reattach it to capture newer edits.

The workspace selection chip provides the current space, selected records, folder and library filter. Use it for requests such as “Move these notes to Planning.” It does not attach every selected record’s contents. Remove the chip to exclude this context, or add it again through **Attach workspace selection**. Each message captures the selection at send time; Retry keeps the original selection.

You can send a message without attachments. The assistant can answer directly or search Code, Notes and HTTP, then read records relevant to your question. Click a linked record in an answer or the **Vault matches** card to open it in its space. Large records and long responses may not fit in one request; the assistant can read additional portions when available.

The assistant determines whether your request needs vault retrieval before answering. An attached item helps interpret phrases such as “explain this” or “compare it with other saved requests”; it does not restrict a question about the rest of the vault.

For vault searches, massCode expands the initial query into a small set of multilingual phrases and ranks the matches before displaying them. Exact names come before broader matches. The **Vault matches** card shows linked record names, with the saved method and URL for HTTP requests. No matches means those phrases did not match; it does not prove that the record is absent. Query translation and the assistant’s explanatory text still depend on the selected model.

HTTP records attached from vault search provide the saved request definition. In the HTTP editor, the assistant can also inspect the current draft, latest response and existing checks, as described below. Sending requests, starting collections and WebSocket actions use a separate HTTP review described below. Recognized credentials are masked before HTTP data is shared with the provider. Upload file references must already be selected in the request or explicitly supplied by you; the assistant cannot browse local files. Arbitrary sensitive text elsewhere in saved content is still content you share with the configured provider.

Use **Stop** to interrupt a response. Partial text remains available to read and copy. If the assistant has already prepared a valid edit proposal, stopping its explanation keeps the proposal available for review.

Use **Retry** on the latest failed or interrupted response to try again. Text you have started writing in the message box is preserved. If a model cannot use tools, it may still answer in plain text, but that answer does not search records or apply changes.

## Work with Notes

Attach a note to summarize it, explain a section, compare it with another record, or find related information in the vault. For example, ask “Summarize the decisions in this note” or “Find the HTTP requests mentioned here.”

Ask the assistant to create a note, rewrite selected text or the open note, update its description, tags or custom properties, or move it to a folder. Editor attachments include unsaved text. Accepted text edits use the normal editor save and Undo workflow. Changes to saved metadata use vault review.

You can also create and update tasks, including status, due date and priority, find tasks by their properties, and organize multiple selected notes. For example, ask “Mark these tasks done” or “Find overdue tasks and move them to Follow-up.” Notes tags can be created, renamed or removed.

## Review Code and Note Edits

Attach an open Code fragment, note or selection, then describe a change and send it normally. Editor edits apply to that attachment. To change saved records found through vault search, use the separate vault review. The assistant prepares exact text replacements for the selected text or entire attached document. The model then continues with a normal Markdown answer explaining the proposed changes, showing code and useful examples. Markdown examples are never treated as edits, regardless of how many code blocks the answer contains. If the explanation fails, the validated proposal remains available for review.

When the proposal is ready and generation has finished or been stopped, choose **Review changes**, inspect the diff and choose **Apply changes** or **Reject changes**. Multiple edits are validated and applied together. The editor saves accepted changes normally; use editor Undo to revert them. Subsequent chat messages include the tool calls and whether their proposals were applied, rejected, invalid, or still awaiting review.

Each proposal is bound to the original context snapshot. Every replacement must match exactly once, and replacements cannot overlap. Changed source, another vault, incomplete calls, and invalid arguments prevent application. If a structurally valid proposal contains missing, ambiguous, or overlapping replacements, massCode sends the validation failure back to the same model for one correction attempt. No changes are applied during correction; a valid result still requires your review. No editor text is changed before confirmation. Exact-match checks protect the application of edits; they do not prove that the proposed code is correct. Review related definitions and calls in the diff. Choose the entire fragment or note when a change affects several parts of it. To apply a proposal after navigating elsewhere, return to the original editor; it must still match the snapshot.

Your selected model must support tool calling through its provider. A plain text answer does not count as a proposal; use a tool-capable model if no proposal is returned. massCode does not silently interpret Markdown as a fallback.

## Create and Organize Vault Records

Ask the assistant to create snippets, notes, HTTP requests, folders or HTTP collections. It can also duplicate records, propose changes to names, descriptions, content, tags, destinations and favorites, move records to Trash, restore them or permanently delete trashed records. Tags are available in Code and Notes. Code snippets support adding, changing and deleting fragments; at least one fragment must remain. Code folders also support a default language.

For example:

- “Create a note summarizing these decisions and tag it architecture.”
- “Create a collection with GET and POST requests for this API.”
- “Group these snippets into folders by language.”
- “Add descriptions to the requests in this collection.”

The assistant can inspect the space’s folders and records before preparing a plan. One proposal contains up to 30 operations, including a new folder and the records that belong in it.

New records are created immediately when you ask for them. The answer includes a clickable link for each successfully created snippet, note or HTTP request.

For changes to existing records, choose **Review vault changes**, inspect the before/after values and select the operations to apply. If a record depends on a new folder, include that folder’s creation too. Applying these operations saves the selected changes to the vault. This differs from **HTTP assertion review**, which only updates the editor draft.

Use **Undo** beside a created record to undo its creation. For reviewed changes, reopen the review to undo an applied operation. Undo is available during the current session, provided the affected record has not changed since application. Undoing creation moves the new record to Trash. A new folder must be empty before it can be undone; undo its child operations first.

Permanent deletion and deletion of folders, tags or fragments do not offer Undo. Deleting a folder removes its descendant folders and moves their records to Trash. Deleting a tag removes its assignments. Review the affected records before applying these operations.

Changed records or a different vault invalidate the proposal. If part of a plan fails, already applied operations remain marked in the review. Inspect the current records and request a fresh proposal for the remaining work. Save or discard an unsaved HTTP draft before applying changes to saved HTTP records.

For saved HTTP requests, the assistant can propose changes to protocol, method, URL, headers, query parameters, body, authentication, assertions, extractions, scripts and transport settings. This includes GraphQL, form data, multipart and existing binary file references. It can duplicate requests, organize collections, change inherited collection settings, and create, update, activate or delete environments. Prefer variable placeholders over literal credentials.

## Run HTTP Workflows

Describe the intended action, then choose **Review HTTP action** and inspect the source and proposed changes before applying it. Saved requests and the current unsaved draft are distinct sources. You can ask the assistant to:

- Change, save or discard the current draft.
- Send a saved request or the current draft.
- Change the draft and send it, or save it and then send it.
- Run a collection in a specified order and inspect its results.
- Connect a saved or draft WebSocket request, send a message, inspect messages or disconnect.
- Inspect HTTP history, console output, cookies and session-variable names.
- Manage cookie settings, clear HTTP data, grant or revoke script trust, or protect and unprotect existing environment variables.

The review is tied to the captured request and environment. Changed data requires a fresh proposal. Applying the same action again cannot repeat its execution. Sending uses the application's normal HTTP runtime, including environment resolution, cookie handling and existing script permissions. Granting script trust is a separate reviewed action; asking to send does not grant it automatically.

Results record what actually finished. If saving fails, a combined save-and-send action does not send. Earlier completed steps can remain applied when a later step fails. Network actions and data-clearing operations have no Undo. Use Stop or ask to cancel a running action; cancellation cannot retract a request already received by the server.

Ask for the action's status or result in a later message. HTTP responses are available to the assistant as bounded, credential-masked context, including when persistent request history is disabled. WebSocket messages and console output also have known secrets masked before being shared; older console entries without this protection provide metadata only. Cookie values and protected environment values are not returned to the model.

## Analyze an HTTP Response and Add Checks

Open an HTTP request and send it to capture a response. Then ask naturally, for example:

- “Explain why this request returned 401.”
- “Look at the latest response and suggest useful checks.”
- “Add a check that the status is 200 and the response has a numeric id.”
- “Are the existing tests enough for this response?”

The assistant can inspect the current draft, the latest execution input, response status, headers, body and existing assertions. When available, it can also inspect captured outgoing headers and redirect URLs. It distinguishes the current draft from the request used for the last execution. Binary bodies and missing portions of truncated responses are unavailable.

An assessment question can produce an explanation without changing anything. When you ask to add checks, the assistant can prepare an assertion proposal:

1. Choose **Review changes** to inspect the proposed checks.
2. Apply or reject the proposal. Accepted checks are appended to the current draft; existing checks are preserved.
3. Save and run the request when ready, either directly or through a separate reviewed HTTP action, to evaluate the checks.

Applying an assertion proposal does **not** save or send the request. If the request, response, environment or checks have changed since the proposal was prepared, ask for a fresh proposal against the current state.

State expected business values or refer to the request’s documented requirements when you need exact checks. A value seen in one response is not necessarily a rule for every response. Assertion proposals use the draft workflow above; changes to saved request fields use the separate vault review workflow. HTTP response assertions do not apply to WebSocket messages; use the WebSocket actions to inspect their connection and messages.

## Import and Export

Ask to import snippets, notes or HTTP data from a supported source. The assistant opens the existing import dialog, where you select files or a source URL, inspect the preview and apply the import. Opening the dialog or generating a preview does not count as completing the import. The chat records the actual outcome; closing a dialog after Apply has started does not cancel the underlying import.

Ask to export a note as HTML or PDF, or a Notes folder as a static site. For an open note, the assistant can use the current editor text, including unsaved changes. The normal save dialog lets you choose the destination. The chat distinguishes completion, cancellation and failure. The assistant does not choose arbitrary filesystem paths or receive the contents of import files merely by opening a dialog.

## Conversations and Privacy

One conversation is shared across Code, Notes and HTTP during the current app session. Closing the panel or switching records and spaces preserves the conversation and does not stop generation. New chat clears the conversation and attachments, then re-enables automatic context and selects the current item. Reloading or restarting the app clears the conversation; changing vaults also clears it.

When a conversation reaches the request size limit, older complete exchanges are left out of the next request and a notice appears in the panel. They remain visible in the chat. The current request and its attached code are not shortened. If the current request itself is too large, select a smaller section.

The configured server receives your messages, the included conversation history, custom instructions, attached context, and records read through vault tools. HTTP context removes recognized credential fields, and execution results mask known secret values before being shared. Protected environment values are resolved by the HTTP runtime without exposing them through AI tools. Arbitrary sensitive text may still be present in request or response content. A local model running on your computer can process these without sending them to a cloud provider. A local server address alone does not guarantee local processing: Ollama can also serve cloud-backed models. massCode does not automatically switch to a cloud provider when a local server is unavailable.

[MCP](/documentation/mcp) is a separate integration for connecting external AI clients to your vault. AI Assistant does not require MCP to be enabled.

## Troubleshooting

- **Server unavailable:** start Ollama or the LM Studio API server and verify the address and port.
- **Model unavailable or unsupported:** check that the selected ID belongs to a chat model available on that server.
- **First response takes time:** a local server may need to load the model before returning text. You can stop the request while it loads.
- **Context is too large:** select a smaller section or start a new conversation. massCode reports the limit instead of silently removing code.
- **Authentication failed:** replace the API key in Preferences.
