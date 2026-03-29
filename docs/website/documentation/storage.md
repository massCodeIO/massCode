# Storage

All your data is stored locally on your computer. massCode uses **Markdown Vault** as its storage engine — snippets and notes are plain Markdown files on disk.

## Markdown Vault

### Why it matters

- **Your data is just files.** Each snippet and note is a `.md` file with frontmatter metadata. No database, no binary formats. You can read, edit, and organize them with any text editor or file manager.
- **Git-friendly.** Store your vault in a Git repository, sync via GitHub, track change history — everything works out of the box because it's just files.
- **Cloud sync.** iCloud, Dropbox, Syncthing — any file sync service will do. No database conflicts.
- **Live sync.** massCode watches the vault directory in real time via a file watcher. Edit a file externally — the app picks up changes automatically.

### How it works

The vault structure mirrors your folder hierarchy. Each folder is a directory on disk, each snippet is a `.md` file inside it. Metadata (language, tags, order) is stored in frontmatter, while `.state.json` handles UI state (expanded folders, sort order).

You can change the vault location in **Settings → Storage**.

## Migration from SQLite

If you are upgrading from an older version of massCode that used SQLite storage, you can import your existing data. Go to **Settings → Storage** and use the import option to select your old `massCode.db` file. Your snippets and folders will be converted to Markdown Vault format.

