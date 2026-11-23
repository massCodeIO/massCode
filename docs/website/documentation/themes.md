---
title: Appearance and Custom Themes
description: "Configure the macOS Dock counter and customize massCode themes for the app UI and editor syntax highlighting."
---

# Appearance and Custom Themes

## macOS Dock Icon Counter

On macOS, open **Settings** > **Appearance** and use **Dock Icon Counter** to show one of these counts on the massCode Dock icon:

- items in the Code Inbox
- items in the Notes Inbox
- tasks due today

Choose **Don't Show** to disable the counter. If macOS blocks the badge, allow notifications and badges for massCode in System Settings.

## Custom Themes

Custom themes let you adapt massCode to your workflow and visual preferences. You can change both the app UI colors and the editor syntax highlighting colors.

## How it works

- Themes are stored in `~/.massCode/themes/` as JSON files.
- Both light and dark theme types are supported.
- When **System** theme mode is selected, you can pair any custom or community light theme with any dark theme to switch automatically with your OS appearance (falling back to built-in themes if a file is removed).
- Theme files are watched in real time — edit the JSON, see the result instantly.

## Creating a Theme

Create a new theme from **Settings** > **Appearance**. massCode generates a Rose Pine-based JSON template with `$schema` autocompletion that you can edit in real time. Once your custom theme is active, click **Submit to Community** to validate it and open a pre-filled Pull Request in [massCodeIO/masscode-themes](https://github.com/massCodeIO/masscode-themes).

## Community Themes

Browse and install themes created by the community directly in **Settings** > **Appearance** > **Community Themes**:

- Preview theme palettes, filter by **Dark** / **Light** / **Installed**, and search by name or author.
- Install and apply any theme in one click — themes are saved to `~/.massCode/themes/` and work with live reload.
- Update or uninstall community themes directly from the gallery; local edits are protected with an explicit confirmation prompt before overwriting or deleting.
- Want to share your own theme? Submit a Pull Request to [massCodeIO/masscode-themes](https://github.com/massCodeIO/masscode-themes).
