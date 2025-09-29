<p align="center">
  <img src="./.github/assets/logo.png" alt="massCode" width="150">
</p>

<h1 align="center">massCode</h1>
<p align="center">
A free, open-source code snippet manager to create, organize, and instantly access your personal snippet library.
</p>

<p align="center">
  <strong>Built with Electron, Vue & Codemirror.</strong>
  <br>
  Inspired by applications like SnippetsLab and Quiver.
</p>

<p align="center">
  <img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/massCodeIO/massCode">
  <img alt="GitHub All Releases" src="https://img.shields.io/github/downloads/massCodeIO/massCode/total">
  <img alt="GitHub" src="https://img.shields.io/github/license/massCodeIO/massCode">
</p>

<p align="center">
  <a href="https://github.com/massCodeIO/massCode/releases">Latest Release</a> |
  <a href="https://masscode.io/documentation/">Documentation</a> |
  <a href="https://github.com/massCodeIO/massCode/blob/master/CHANGELOG.md">Change Log</a>
</p>

<p align="center">
  Extensions:
  <a href="https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant">VS Code</a> |
  <a href="https://www.raycast.com/antonreshetov/masscode">Raycast</a>
</p>

<p align="center">
  <strong>SPONSORS</strong>
</p>

<p align="center">
  <a href="https://m.do.co/c/f2bb3bfab2e6">
    <img src='.github/assets/DO.svg'>
  </a>
  &nbsp;
  <a href="https://mysigmail.com/?ref=github/massCodeIO">
    <img src='.github/assets/MySigMail.svg'>
  </a>
</p>

## Support

massCode is an open-source project and completely free to use.

Maintaining and adding new features requires significant time and effort. If you find massCode useful, consider supporting its development. Your contribution helps keep the project alive and moving forward.

You can support massCode through the following channels:
<div align="center">

[![Donate via Open Collective](https://img.shields.io/badge/donate-Open%20Collective-blue.svg?style=popout&logo=opencollective)](https://opencollective.com/masscode)
[![Donate via PayPal](https://img.shields.io/badge/donate-PayPal-blue.svg?style=popout&logo=paypal)](https://paypal.me/antongithub)
[![Donate via Ko-Fi](https://img.shields.io/badge/donate-Gumroad-blue?style=popout&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzNCAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGVsbGlwc2UgY3g9IjE5LjgyODciIGN5PSIxOS4xMzU5IiByeD0iMTQuMTcxNCIgcnk9IjEzLjY3NjUiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0xNi4xNzE0IDI5Ljk0NjRDMjQuNDAzMiAyOS45NDY0IDMxLjEyNDEgMjMuNDk5NSAzMS4xMjQxIDE1LjQ4ODdDMzEuMTI0MSA3LjQ3OCAyNC40MDMyIDEuMDMxMDEgMTYuMTcxNCAxLjAzMTAxQzcuOTM5NyAxLjAzMTAxIDEuMjE4NzUgNy40NzggMS4yMTg3NSAxNS40ODg3QzEuMjE4NzUgMjMuNDk5NSA3LjkzOTcgMjkuOTQ2NCAxNi4xNzE0IDI5Ljk0NjRaIiBmaWxsPSIjRkY5MEU4IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEuNTYyNSIvPgo8cGF0aCBkPSJNMTUuMDQ2NyAyMi43ODI3QzEwLjg2MiAyMi43ODI3IDguNDAwMzkgMTkuNDAyNCA4LjQwMDM5IDE1LjE5NzZDOC40MDAzOSAxMC44Mjc5IDExLjEwODEgNy4yODI3MSAxNi4yNzc0IDcuMjgyNzFDMjEuNjEwOSA3LjI4MjcxIDIzLjQxNiAxMC45MTA0IDIzLjQ5ODEgMTIuOTcxNUgxOS42NDE2QzE5LjU1OTYgMTEuODE3MyAxOC41NzQ5IDEwLjA4NTkgMTYuMTk1NCAxMC4wODU5QzEzLjY1MTggMTAuMDg1OSAxMi4wMTA3IDEyLjMxMiAxMi4wMTA3IDE1LjAzMjdDMTIuMDEwNyAxNy43NTM1IDEzLjY1MTggMTkuOTc5NSAxNi4xOTU0IDE5Ljk3OTVDMTguNDkyOSAxOS45Nzk1IDE5LjQ3NzUgMTguMTY1NyAxOS44ODc4IDE2LjM1MTlIMTYuMTk1NFYxNC44Njc4SDIzLjk0MzJWMjIuNDUyOUgyMC41NDQyVjE3LjY3MUMyMC4yOTggMTkuNDAyNCAxOS4yMzEzIDIyLjc4MjcgMTUuMDQ2NyAyMi43ODI3WiIgZmlsbD0iYmxhY2siLz4KPC9zdmc+Cg==)](https://antonreshetov.gumroad.com/l/masscode)

</div>

## Features

### Organization

Organize your snippets with multi-level folders and tags. Each snippet can contain multiple fragments (tabs), giving you fine-grained control over structure and grouping.

### Editor

Built on [CodeMirror](https://github.com/codemirror/codemirror5) with `.tmLanguage` grammars for syntax highlighting.

* Supports over [600 grammars](https://github.com/github/linguist/blob/master/vendor/README.md), with 160+ available out of the box.
* Integrated [Prettier](https://prettier.io) for clean, consistent code formatting.

### Real-time HTML & CSS Preview

Write and instantly preview HTML and CSS snippets. Perfect for prototyping, testing ideas, or quick visual checks.

### Markdown

Full Markdown support with syntax highlighting, tables, lists, and more.

* Integrated [Mermaid](https://mermaid-js.github.io/mermaid/#) for dynamic diagrams and charts.

### Presentation Mode

Turn a sequence of snippets into a presentation. Useful for classrooms, team meetings, conference talks, or simply walking through your own notes.

### Mindmap

Generate mind maps from Markdown. Fast, intuitive, and ideal for structuring and visualizing ideas.

### Integrations

Extend your workflow with:

* [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant): zen mode snippet search, instant insertion, and save selected code as snippets.
* [Raycast Extension](https://www.raycast.com/antonreshetov/masscode): quick snippet access directly from Raycast.

### Beautiful Screenshots

Export snippets as polished images with customizable themes and backgrounds.

### Developer Tools

Handy built-in utilities for everyday dev tasks:

* **Text Tools**: Case Converter, Slug Generator, URL Parser
* **Crypto & Security**: Hash/HMAC, Password Generator, UUID
* **Encoders/Decoders**: URL, Base64, JSON ⇄ TOML/XML/YAML, Text ⇄ ASCII/Binary/Unicode, Color Converter

## Overview

massCode was created as a personal learning project and evolved into an open-source tool. The goal: combine the best features of snippet managers (free and paid) into one flexible, developer-friendly application.

## Build Locally

### Prerequisites

- Node.js (>=20.16.0)
- pnpm (>= 9.0.0)

### Install Dependencies

```bash
pnpm install
```

### Build

To build for current platform:

```bash
pnpm build
```

To build for a specific platform:

```bash
pnpm build:mac    # macOS
pnpm build:win    # Windows
pnpm build:linux  # Linux
```

### Development

To run in development mode:

```bash
pnpm dev
```

This will start the application with hot reloading.

## Troubleshooting

If you encounter the error message "massCode" is damaged and can't be opened. You should move it to the Trash while installing software on macOS, it may be due to security settings restrictions in macOS. To solve this problem, please try the following command in Terminal:

```bash
sudo xattr -r -d com.apple.quarantine /Applications/massCode.app
```

## Follow
 - News and updates on [X](https://x.com/anton_reshetov).
 - [Discussions](https://github.com/massCodeIO/massCode/discussions).

![](.github/assets/subscribe.gif)

## License

[AGPL-3.0](https://github.com/massCodeIO/massCode/blob/master/LICENSE)

Copyright (c) 2019-present, [Anton Reshetov](https://github.com/antonreshetov).
