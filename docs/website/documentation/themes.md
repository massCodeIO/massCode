---
title: Appearance and Custom Themes
description: "Configure the macOS Dock counter and customize massCode themes for the app UI and editor syntax highlighting."
---

# Appearance and Custom Themes

## macOS Dock Icon Counter

<AppVersion text=">=5.9" />

On macOS, open **Settings** > **Appearance** and use **Dock Icon Counter** to show one of these counts on the massCode Dock icon:

- items in the Code Inbox
- items in the Notes Inbox
- tasks due today

Choose **Don't Show** to disable the counter. If macOS blocks the badge, allow notifications and badges for massCode in System Settings.

## Custom Themes

<AppVersion text=">=4.5" />

Custom themes let you adapt massCode to your workflow and visual preferences. You can change both the app UI colors and the editor syntax highlighting colors.

## How it works

- Themes are stored in `~/.massCode/themes/` as JSON files.
- Both light and dark theme types are supported.
- Theme files are watched in real time — edit the JSON, see the result instantly.

## Creating a Theme

Create a new theme from **Settings** > **Appearance**. massCode generates a Rose Pine-based JSON template that you can use as a starting point and edit in real time.
