---
title: WebSocket
description: "Connect to WebSocket endpoints, configure authentication, and exchange messages in massCode."
---

# WebSocket

<AppVersion text=">=5.11" />

Choose **WebSocket** in the method/type selector beside the URL. Existing saved requests remain HTTP unless you change their type.

## Connect and Send Messages

1. Enter a `ws://` or `wss://` URL and configure **Params**, **Headers**, and **Auth** as needed. None, **Inherit from parent**, Basic, Bearer, and API Key use the same [authorization](./authorization) configuration as HTTP. WebSocket handshake headers are managed by the client; do not add `Host`, `Connection`, `Upgrade`, or `Sec-WebSocket-*` headers manually.
2. Click **Connect**. Connecting uses the current draft without saving it. Connection attempts time out after 15 seconds. TLS certificates are verified unless you explicitly disable verification in HTTP settings. Redirects are not followed.
3. Write text or JSON in **Message**, then click **Send message**. JSON is sent as text without additional validation. An empty message is allowed.
4. Inspect received and sent messages in **Messages**, then click **Disconnect** when finished. **Clear messages** clears the log without disconnecting.

For a server you control, use its documented URL and authentication; for example, `wss://your-api.example/events` is a placeholder, not a runnable service. A browser application's Socket.IO endpoint is not necessarily a plain WebSocket endpoint.

<img :src="withBase('/http-websocket.png')" alt="Connected WebSocket request with its message log">

## Variables and Authentication

Collection/folder defaults, the active environment, and manual Session variables are captured when connecting, with Session taking highest priority. Use <code v-pre>{{name}}</code> in the URL, params, headers, auth, or outgoing messages. Later edits to connection settings or variable values require reconnecting. Known secret and Session placeholders are masked in the outgoing log; incoming server messages are shown as received and may contain sensitive data.

## Message Log and Limits

**Save** persists the request type, connection settings, and message draft in the vault, not the conversation. The log keeps the latest 100 messages in memory, with previews limited to 16 KiB. Messages larger than 1 MiB are rejected; an oversized incoming message closes the connection. Received binary messages are displayed as Base64 previews. Sending binary files is not supported.

Switching requests, changing the environment or vault, clearing Session, leaving the HTTP space, or reloading or quitting the app closes the connection. Returning to the request does not reconnect automatically. Reconnecting starts a new log.

WebSocket requests do not run assertions, response extraction, scripts, code generation, or Folder Runner steps. Socket.IO and subprotocol negotiation are not supported.

<script setup>
import { withBase } from 'vitepress'
</script>
