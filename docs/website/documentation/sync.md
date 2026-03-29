# Sync

massCode gives you the ability to synchronize your snippets library across multiple computers.

## SQLite Storage

You can move your storage folder to a location managed by a sync service such as iCloud Drive, Google Drive, or Dropbox, and get the ability to synchronize your library on other computers.

::: warning
When using SQLite storage with cloud sync services, avoid opening the same database from multiple devices simultaneously, as this may cause database conflicts.
:::

## Markdown Vault

<AppVersion text=">=4.5" />

With [Markdown Vault](/documentation/storage#markdown-vault), syncing becomes much simpler since your snippets are just plain files. You can use any file sync service — iCloud, Dropbox, Syncthing, or even a Git repository. There are no database conflicts to worry about, and massCode watches the vault directory in real time, so changes made externally are picked up automatically.
