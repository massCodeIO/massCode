---
title: Sync Your Markdown Vault
description: "Sync massCode across devices by pairing the Markdown Vault with iCloud, Dropbox, Google Drive, Syncthing, or Git."
---

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

## Offloaded (online-only) files

<AppVersion text=">=5.9" />

Cloud services can free up disk space by keeping only file placeholders on your device: the file is visible on disk, but its content stays in the cloud until it is read. This happens with iCloud Drive (Optimize Mac Storage), OneDrive (Files On-Demand), Google Drive (online-only), and Dropbox (online-only).

massCode handles offloaded vault files without freezing:

- Snippets, notes, and HTTP requests whose files are offloaded still appear in lists right away, marked with a cloud icon.
- Their content is downloaded in the background. Overall progress is shown at the bottom of the space rail.
- Opening an offloaded item moves it to the front of the download queue; the content appears as soon as it is fetched.
- The app never overwrites a file whose content has not been downloaded yet, so no data is lost.

For the smoothest experience, tell your cloud service to keep the vault folder downloaded:

- **iCloud Drive (macOS 15+)**: right-click the vault folder and choose **Keep Downloaded**. On macOS 14 and earlier, disable **Optimize Mac Storage** in iCloud settings.
- **OneDrive**: right-click the vault folder and choose **Always keep on this device**.
- **Google Drive**: mark the vault folder as **Available offline**.
- **Dropbox**: set the vault folder to **Make available offline**.
