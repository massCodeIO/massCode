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

The URL field keeps variables visible while you edit. Preview and request execution resolve variables from the active environment and Session. Previews mask secret and Session values; execution substitutes their real values.

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

On Linux, encryption depends on a supported system keyring. If one is not available, secret storage is disabled and **Add secret** cannot be used.
:::

### How Secrets Are Stored

Values live in massCode application data, in an `http-secrets.json` file next to the other app settings, and are encrypted by the operating system: Keychain on macOS, DPAPI on Windows, and the system keyring on Linux.

Each value is bound to a pair of a vault, identified by its path on disk, and an environment. This has a few practical consequences:

- Moving the vault in **Settings → Storage** carries secret values along with it.
- Switching to a different existing vault does not pick up values entered for the previous one, because it is another vault.
- Deleting an environment also deletes its local secret values.

Values are decrypted only in the main process, when a request runs or when you click the eye icon to reveal a single value. The interface receives a value only for that explicit reveal action. The request preview, the cURL command you copy from it, and the request history (both the URL and the error text) show a mask. During execution, the real value is used in the outgoing network request and is also available to [trusted scripts](/documentation/http/scripts#review-and-trust).

If a value cannot be decrypted, for example because the file was written by a different operating system user or the keychain has changed, the secret is treated as not set: it shows **Not set on this device** and resolves to an empty value. The request still runs.

## Active Environment

Use the **Environments** panel below folders to choose the active environment.

Select **No environment** to stop applying environment variables. Session variables can still be extracted and used while no environment is selected. Placeholders without a matching variable remain unresolved.

## Session Variables and Inspector

<AppVersion text=">=5.11" />

Open the **Variables inspector** using the braces icon next to **Environments**. It lists Environment and Session separately, masks secret and Session values, and marks environment entries overridden by Session. A Session value takes priority even when the matching environment variable is a secret.

Create Session values through **Variables → Post-response** or with `mc.variables.set()` in a [script](/documentation/http/scripts). See [Tests & Variables](/documentation/http/tests) for a login example and extraction behavior.

Use <code v-pre>{{name}}</code> in subsequent requests. Session values are reusable, not consumed by the next request: they remain available until replaced by another extraction or cleared. Overriding a variable does not change its saved environment value. If the Session value is removed, requests use the matching environment value again; without one, the placeholder remains unresolved.

Session values live only in memory. **Clear session**, switching environments (including **No environment**), switching vaults, or quitting or restarting the app clears them. Returning to a previous environment does not restore its Session values. Regular environment edits are autosaved; Session values are not written into the environment or vault.

The [Folder runner](/documentation/http/runner#variables-and-failures) uses its own temporary variables over the selected environment. It neither reads nor changes these manual Session values.

## Managing Environments

Open **Manage** from the Environments panel to create environments and edit variables.

Each environment has:

- a name
- a key-value table of variables

The active environment is stored as part of the HTTP space state.

<script setup>
import { withBase } from 'vitepress'
</script>
