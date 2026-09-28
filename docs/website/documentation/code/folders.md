---
title: Code Folders
description: "Organize snippets in massCode with nested folders, renaming, moving, and deletion workflows in the Code space."
---

# Folders

Folders help you organize snippets by project, topic, language, or any structure that fits your workflow. When you select a folder in the sidebar, massCode shows snippets from that folder and all of its subfolders in the second column.

## Adding a Folder

Use one of these methods:

- Select **"File"** > **"New Folder"** from the menu bar.
- Click the **"+"** button next to **"FOLDERS"** in the library.
- Press <kbd>Shift+Cmd+N</kbd> on macOS or <kbd>Shift+Ctrl+N</kbd> on Windows or Linux.

## Moving to Folder

Drag one folder onto another to create a nested folder structure.

## Renaming and Deleting

Right-click the folder and choose **"Rename"** or **"Delete"**.

::: warning
Deleting a folder moves all its snippets and subfolders to **"Inbox"**.
:::

## Set the Default Folder Language

Set a default language when most snippets in a folder use the same syntax.

Right-click the folder and choose **"Default Language"**.

## Setting a Folder Icon

<AppVersion text=">=3.7" />

Folder icons help large libraries stay easier to scan. Right-click a folder and choose **Set Icon**. Use the **Icons** tab to search the built-in Material and Lucide icon collections.

To restore the default folder icon, right-click the folder and choose **Remove Icon**.

### Emoji and Uploaded Images

<AppVersion text=">=5.9" />

The icon picker also supports:

- **Emoji** - search the Unicode emoji catalog. Emoji appearance follows your operating system.
- **Upload** - choose or drop a JPG or PNG image up to 10 MB, review the preview, then click **Use image**.

Uploaded images are cropped from the center, resized to 128×128, and saved as PNG.

Uploaded icons are stored as a hidden `.icon.png` file inside the folder, so they stay with the folder when you back up or sync your Markdown Vault.
