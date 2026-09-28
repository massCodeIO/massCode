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

::: warning
Vault files are stored as plain text. Do not store passwords, API tokens, private keys, or other secrets in snippets, notes, or HTTP requests if your vault is synced, shared, or committed to Git. Use an external secret manager for real credentials.

In HTTP environments, use [secret variables](/documentation/http/environments#secret-variables) for such values: their names stay in the vault, but the values are kept outside it, encrypted on the device where you entered them.
:::

### How it works

The vault mirrors your folder structure. Each folder becomes a directory on disk, and each snippet or note becomes a `.md` file inside it. Metadata such as language, tags, and ordering is stored in frontmatter, while `.state.json` stores UI state like expanded folders and sort order.

You can change the vault location in **Settings → Storage**.

### File Name Restrictions

Because Markdown Vault maps folders, snippets, and notes directly to files and directories on disk, massCode applies a small set of cross-platform naming rules.

Names cannot contain `< > : " / \ | ? * # [ ] ^`, cannot start or end with `.`, and cannot use Windows reserved names such as `CON`, `PRN`, `AUX`, `NUL`, `COM1`, or `LPT1`. These rules keep filenames portable across Windows, macOS, and Linux while also avoiding conflicts with Obsidian-style Markdown links and block references in shared vault workflows.

## Upgrade from v4 SQLite to v6

massCode v6 uses Markdown Vault only. It cannot open or import a legacy `massCode.db` SQLite database or a v3 `db.json` library. Use [massCode v5.12.0](https://github.com/massCodeIO/massCode/releases/tag/v5.12.0) to convert a v4 library before opening it in v6.

If you already use a Markdown Vault in v5, no database conversion is needed: open the same vault in v6 from **Settings → Storage**.

To migrate a v4 library:

1. Close massCode and back up your old library directory, including `massCode.db`. Keep this backup until you have verified the result.
2. Download and open [massCode v5.12.0](https://github.com/massCodeIO/massCode/releases/tag/v5.12.0).
3. In v5, open **Settings → Storage** and use **Select Directory** to choose a separate, empty directory as the target Markdown Vault.
4. Choose **Migrate to Markdown Vault**, select your old `massCode.db` file, and confirm the migration.
5. Check that your folders, snippets, and tags are present in the resulting vault.
6. Close v5, open v6, and select that same vault directory in **Settings → Storage**.

::: warning Existing Code content is replaced
The v5 migration replaces the Code content in the selected vault with the SQLite library. Select a separate, empty target directory before migrating. Keep backups of your old library and any existing vault.
:::

## Upgrade from v3 `db.json`

First convert the v3 JSON library with [massCode v4.7.1](https://github.com/massCodeIO/massCode/releases/tag/v4.7.1), then follow the v4 migration steps above using v5.12.0.

```text
v3 db.json → v4.7.1 massCode.db → v5.12.0 Markdown Vault → v6
```

1. Close massCode and back up your existing `db.json` and library directory.
2. Install and open [massCode v4.7.1](https://github.com/massCodeIO/massCode/releases/tag/v4.7.1) to migrate the v3 library. On macOS, see [Opening v4.7.1 on macOS](#opening-v4-7-1-on-macos) if the app is blocked.
3. Confirm that your snippets are visible in v4 and that a `massCode.db` file was created.
4. Follow [Upgrade from v4 SQLite to v6](#upgrade-from-v4-sqlite-to-v6).

If you still have only `db.json`, complete the v4 conversion first. Neither v5 nor v6 can import that file directly.

### Opening v4.7.1 on macOS

The macOS build of v4.7.1 was not code-signed or notarized. Signing and notarization were restored in [v5.6.0](https://github.com/massCodeIO/massCode/releases/tag/v5.6.0), so the v5.12.0 build used above does not normally need this workaround.

If macOS reports that v4.7.1 is damaged or cannot be opened, download it from the official release linked above, move **massCode.app** to **Applications**, and run this command in Terminal:

```bash
sudo xattr -r -d com.apple.quarantine "/Applications/massCode.app"
```

Then open massCode again and continue the migration. This removes the quarantine attribute only from that app; it does not disable Gatekeeper system-wide.
