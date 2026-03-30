---
title: Markdown Vault Storage
description: "Learn how massCode stores snippets and notes locally in a Markdown Vault with plain files, frontmatter metadata, and Git-friendly structure."
---

# Storage

massCode stores your data locally on your computer. Snippets and notes live in a **Markdown Vault**, so your content stays as plain Markdown files on disk instead of being locked into a cloud service or a private database format.

## Markdown Vault

### Why it matters

- **Your data is just files.** Each snippet and note is a `.md` file with frontmatter metadata. You can read, edit, move, and back up everything with any text editor or file manager.
- **No vendor lock-in.** If you stop using massCode, your content still remains readable as plain files.
- **Git-friendly.** Put the vault in a Git repository, track changes, and sync it through your normal workflow.
- **Cloud-sync friendly.** iCloud, Dropbox, Google Drive, or Syncthing all work because the vault is just a folder on disk.
- **Live updates.** massCode watches the vault in real time, so external file changes appear in the app automatically.

### How it works

The vault mirrors your folder structure. Each folder becomes a directory on disk, and each snippet or note becomes a `.md` file inside it. Metadata such as language, tags, and ordering is stored in frontmatter, while `.state.json` stores UI state like expanded folders and sort order.

You can change the vault location in **Settings → Storage**.

## Migration from SQLite

If you are upgrading from an older version of massCode that used SQLite storage, you can import your existing data into Markdown Vault.

- Open **Settings → Storage**
- Choose the import option
- Select your old `massCode.db` file

massCode converts your folders and snippets to Markdown Vault format.
