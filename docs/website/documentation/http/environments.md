---
title: HTTP Environments
description: "Use HTTP environments in massCode to manage reusable variables for local, staging, and production API requests."
---

# Environments

Environments store reusable variables for requests. Use them for values that change between local, staging, and production APIs, such as base URLs, user IDs, and organization IDs.

::: warning Plain text variables
Regular environment variables are stored as plain text in your Markdown Vault, so they travel with it when the vault is synced, shared, or committed to Git. For passwords, API tokens, private keys, and similar values use [secret variables](#secret-variables) instead.
:::

<img :src="withBase('/http-envs.png')">

## Variables

Use variables with double braces:

```text
{{apiUrl}}/v1/users/{{userId}}/sessions
```

The URL field keeps variables visible while you edit. Preview and request execution resolve variables from the active environment.

Variables can be used in:

- URL
- params
- headers
- body
- auth fields

## Secret Variables

<AppVersion text=">=5.10" />

Secret variables keep sensitive values out of the vault. The value is encrypted with your operating system keychain and stored locally, outside the Markdown Vault.

To create one, open **Manage**, click **Add secret**, then enter a name and a value. The value is saved when you leave the value field.

You can also protect a variable that already exists: select the **Secret** checkbox next to it. massCode encrypts the current value and removes it from the vault.

::: warning Rotate values you protect later
By the time you select the checkbox, the plain text value has almost certainly been written to `.state.yaml` by autosave, so it may already have reached a synced cloud folder or your Git history. Removing it from the vault does not undo that. Treat such values as exposed and rotate them.
:::

Secrets are used like any other variable, with the same <code v-pre>{{name}}</code> syntax. When a request runs, massCode substitutes the real value, but the request history stores only a mask.

Working with existing secrets:

- Click the eye icon to show the stored value.
- Clear the **Secret** checkbox to stop protecting a variable. Its value is moved back into the environment as a regular plain text variable.
- To rename a secret, delete it and add it again.

::: warning Secrets are not synced
Only the secret name is stored in the vault. The value never leaves the device where you entered it, so on other devices the same secret shows **Not set on this device** and resolves to an empty value until you enter it there.

On Linux, encryption depends on an available system keyring. Without one, secret storage can be unavailable or provide weaker protection, and **Add secret** is disabled.
:::

### How Secrets Are Stored

Values live in massCode application data, in an `http-secrets.json` file next to the other app settings, and are encrypted by the operating system: Keychain on macOS, DPAPI on Windows, and the system keyring on Linux.

Each value is bound to a pair of a vault, identified by its path on disk, and an environment. This has a few practical consequences:

- Moving the vault in **Settings → Storage** carries secret values along with it.
- Switching to a different existing vault does not pick up values entered for the previous one, because it is another vault.
- Deleting an environment also deletes its local secret values.

Values are decrypted only in the main process, at the moment a request runs. The interface never receives them, except when you click the eye icon to reveal a single value. The request preview, the cURL command you copy from it, and the request history (both the URL and the error text) show a mask. The real value goes only into the outgoing network request.

If a value cannot be decrypted, for example because the file was written by a different operating system user or the keychain has changed, the secret is treated as not set: it shows **Not set on this device** and resolves to an empty value. The request still runs.

## Active Environment

Use the **Environments** panel below folders to choose the active environment.

Select **No environment** when you want requests to keep variables unresolved. This is useful when you are editing templates or copying a request without applying local values.

## Managing Environments

Open **Manage** from the Environments panel to create environments and edit variables.

Each environment has:

- a name
- a key-value table of variables

The active environment is stored as part of the HTTP space state.

<script setup>
import { withBase } from 'vitepress'
</script>
