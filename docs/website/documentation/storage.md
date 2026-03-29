# Storage

All your snippets are on your computer locally. massCode supports two storage engines: **Markdown Vault** (default) and **SQLite** (legacy). You can switch between them in **Settings → Storage**.

## Markdown Vault

<AppVersion text=">=4.5" />

Starting from v4.5.0, you can store your snippets as plain Markdown files directly on disk. This is the default and recommended storage engine.

### Why it matters

- **Your data is just files.** Each snippet is a `.md` file with frontmatter metadata. No database, no binary formats. You can read, edit, and organize snippets with any text editor or file manager.
- **Git-friendly.** Store snippets in a Git repository, sync via GitHub, track change history — everything works out of the box because it's just files.
- **Cloud sync.** iCloud, Dropbox, Syncthing — any file sync service will do. No database conflicts.
- **Live sync.** massCode watches the vault directory in real time via a file watcher. Edit a file externally — the app picks up changes automatically.

### How it works

The vault structure mirrors your folder hierarchy. Each folder is a directory on disk, each snippet is a `.md` file inside it. Metadata (language, tags, order) is stored in frontmatter, while `.state.json` handles UI state (expanded folders, sort order).

To enable Markdown Vault, go to **Settings → Storage** and switch the storage engine.

## SQLite (Legacy)

SQLite storage engine uses a SQLite database (`massCode.db`). You can change the folder where your snippets will be stored or open and import existing snippets.

::: warning
Do not place the SQLite database on shared or network drives (e.g. iCloud, Dropbox, Google Drive). SQLite uses file-level locking, which means two applications cannot open the same database simultaneously. This can lead to data corruption or lock errors.
:::

### Open Existing

- Click on the **Open storage** button.
- Select the folder containing the file `massCode.db`.

### Move

- Click on the **Move storage** button.
- Select the folder where the `massCode.db` file will be moved.

## Migrate

### From massCode v3

To migrate from massCode v3.0 select the folder containing the `db.json` file.
