
<p align="center">
  <img src="./preview.png">
</p>

<h1 align="center">massCode</h1>

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
  <a href="https://www.raycast.com/antonreshetov/masscode">Raycast</a> |
  <a href="https://github.com/massCodeIO/assistant-alfred">Alfred</a>
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

massCode is open source project and completely free to use.

However, the amount of effort needed to maintain and develop new features for the project is not sustainable without proper financial backing. You can support massCode development via the following methods:

<div align="center">

[![Donate via Open Collective](https://img.shields.io/badge/donate-Open%20Collective-blue.svg?style=popout&logo=opencollective)](https://opencollective.com/masscode)
[![Donate via PayPal](https://img.shields.io/badge/donate-PayPal-blue.svg?style=popout&logo=paypal)](https://paypal.me/antongithub)
[![Donate via Ko-Fi](https://img.shields.io/badge/donate-Gumroad-blue?style=popout&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzNCAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGVsbGlwc2UgY3g9IjE5LjgyODciIGN5PSIxOS4xMzU5IiByeD0iMTQuMTcxNCIgcnk9IjEzLjY3NjUiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0xNi4xNzE0IDI5Ljk0NjRDMjQuNDAzMiAyOS45NDY0IDMxLjEyNDEgMjMuNDk5NSAzMS4xMjQxIDE1LjQ4ODdDMzEuMTI0MSA3LjQ3OCAyNC40MDMyIDEuMDMxMDEgMTYuMTcxNCAxLjAzMTAxQzcuOTM5NyAxLjAzMTAxIDEuMjE4NzUgNy40NzggMS4yMTg3NSAxNS40ODg3QzEuMjE4NzUgMjMuNDk5NSA3LjkzOTcgMjkuOTQ2NCAxNi4xNzE0IDI5Ljk0NjRaIiBmaWxsPSIjRkY5MEU4IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEuNTYyNSIvPgo8cGF0aCBkPSJNMTUuMDQ2NyAyMi43ODI3QzEwLjg2MiAyMi43ODI3IDguNDAwMzkgMTkuNDAyNCA4LjQwMDM5IDE1LjE5NzZDOC40MDAzOSAxMC44Mjc5IDExLjEwODEgNy4yODI3MSAxNi4yNzc0IDcuMjgyNzFDMjEuNjEwOSA3LjI4MjcxIDIzLjQxNiAxMC45MTA0IDIzLjQ5ODEgMTIuOTcxNUgxOS42NDE2QzE5LjU1OTYgMTEuODE3MyAxOC41NzQ5IDEwLjA4NTkgMTYuMTk1NCAxMC4wODU5QzEzLjY1MTggMTAuMDg1OSAxMi4wMTA3IDEyLjMxMiAxMi4wMTA3IDE1LjAzMjdDMTIuMDEwNyAxNy43NTM1IDEzLjY1MTggMTkuOTc5NSAxNi4xOTU0IDE5Ljk3OTVDMTguNDkyOSAxOS45Nzk1IDE5LjQ3NzUgMTguMTY1NyAxOS44ODc4IDE2LjM1MTlIMTYuMTk1NFYxNC44Njc4SDIzLjk0MzJWMjIuNDUyOUgyMC41NDQyVjE3LjY3MUMyMC4yOTggMTkuNDAyNCAxOS4yMzEzIDIyLjc4MjcgMTUuMDQ2NyAyMi43ODI3WiIgZmlsbD0iYmxhY2siLz4KPC9zdmc+Cg==)](https://antonreshetov.gumroad.com/l/masscode)

</div>

## Features
### Organization
massCode allows you to organize snippets using multi-level folders as well as tags. Each snippet has fragments - tabs, which gives even greater level of organization.

### Editor
massCode uses [Codemirror](https://github.com/codemirror/codemirror5) as the basis for the editor and `.tmLanguage` as the grammar for syntax highlighting. This tandem opens the door to over [600](https://github.com/github/linguist/blob/master/vendor/README.md) existing grammars. The application currently supports more than [160](https://github.com/massCodeIO/massCode/tree/master/src/renderer/components/editor) grammars. In addition to `.tmLanguage`, the application supports `.tmTheme` for themes. There is also support for [Prettier](https://prettier.io) for code formatting. 

### Real-time Render for HTML & CSS
You can not only collect snippets, but also see the rendering result for HTML and CSS in real time. Test the idea or just view the result.

### Markdown
massCode allows you to write in Markdown and provide support to syntax highlighting, tables, list and other formatting. Also massCode supports [Mermaid](https://mermaid-js.github.io/mermaid/#) - diagramming and charting tool that renders Markdown-inspired text definitions to create and modify diagrams dynamically.

### Presentation Mode

massCode allows you to make a presentation out of a sequence of snippets. It's great for classroom use, team meetings, conferences or simply reviewing notes on your own.

### Mindmap

massCode allows you to create mental maps from markdown, making the process of creating and editing maps fast and intuitively understandable. It's a great way to organize and structure information visually.

### Search
It is impossible to imagine a productive snippets manager without quick access to snippets. Therefore massCode has a fast full-text search with highlighting of the search query.

### Autosave
massCode automatically saves any changes you make during work, so you don't have to worry about losing changes.

### Sync
You can use any service that provides cloud synchronization, such as iCloud Drive, Google Drive, Dropbox or other similar.

### Database
massCode uses a simple JSON to store your data. The database files are on your local computer.

### Integrations
massCode supports extensions for [VS Code](https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant), [Raycast](https://www.raycast.com/antonreshetov/masscode) and [Alfred](https://github.com/massCodeIO/assistant-alfred), which gives even more possibilities to use application. With the VS Code extension you get practically zen mode, search for the necessary snippets and insert them immediately or save the selected code sections as a snippet.

### Beautiful Screenshots
Create beautiful snippet images on different backgrounds and in different modes

### Developer Tools
massCode provides developers with a range of convenient tools, such as:
-  Text tools: Case Converter, Slug Generator, Sort Lines, URL Parser
-  Cryptography & Security: Hash, HMAC, Password and UUID Generators
-  Encoders & Decoders: URL, Base64


## Overview

The goal of creating this application was mostly my own growth as a developer. Also, I wanted this project to absorb the best of such applications already on the market (both free and paid). At the same time, I wanted this project to be an open source project.

## Follow
 - News and updates on [Twitter](https://twitter.com/anton_reshetov).
 - [Discussions](https://github.com/massCodeIO/massCode/discussions).

![](.github/assets/subscribe.gif)

## Other
You can also [download](https://github.com/antonreshetov/massCode) massCode v1.

## License

[AGPL-3.0](https://github.com/massCodeIO/massCode/blob/master/LICENSE)

Copyright (c) 2019-present, [Anton Reshetov](https://github.com/antonreshetov).