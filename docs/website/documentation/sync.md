# Sync

massCode does not require a built-in cloud account or a proprietary sync service. To sync your data across devices, sync your **Markdown Vault** folder with the file service you already trust.

Because massCode uses [Markdown Vault](/documentation/storage#markdown-vault), syncing is straightforward: your data is just plain files on disk. Point any file sync service at your vault directory:

- iCloud Drive
- Dropbox
- Google Drive
- Syncthing
- Git repository

This approach works well if you want:

- the same snippets and notes on multiple computers
- version history through Git
- full control over where your data lives

massCode watches the vault directory in real time, so changes made outside the app are picked up automatically.
