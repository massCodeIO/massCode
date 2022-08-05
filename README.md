
<p align="center">
  <img src="./preview.png">
</p>

<h1 align="center">massCode</h1>

<p align="center">
  <strong>Built with Electron, Vue 3 & Ace Editor.</strong>
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


## Support

massCode need your support, give a [star](https://github.com/massCodeIO/massCode/stargazers) on this repo or [donate](https://opencollective.com/masscode). All of this is valuable and will inspire further development.

## Features
### Organization
massCode allows you to organize snippets using multi-level folders as well as tags. Each snippet has fragments - tabs, which gives even greater level of organization.

### Editor
massCode uses [Codemirror](https://github.com/codemirror/codemirror5) as the basis for the editor and `.tmLanguage` as the grammar for syntax highlighting. This tandem opens the door to over [600](https://github.com/github/linguist/blob/master/vendor/README.md) existing grammars. The application currently supports more than [160](https://github.com/massCodeIO/massCode/tree/master/src/renderer/components/editor) grammars. In addition to `.tmLanguage`, the application supports `.tmTheme` for themes. There is also support for [Prettier](https://prettier.io) for code formatting. 

### Real-time Render for HTML & CSS
You can not only collect snippets, but also see the rendering result for HTML and CSS in real time. Test the idea or just view the result.

### Markdown
massCode allows you to write in Markdown and provide support to syntax highlighting, tables, list and other formatting. Also massCode supports [Mermaid](https://mermaid-js.github.io/mermaid/#) - diagramming and charting tool that renders Markdown-inspired text definitions to create and modify diagrams dynamically.

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

## Overview

The goal of creating this application was mostly my own growth as a developer. Also, I wanted this project to absorb the best of such applications already on the market (both free and paid). At the same time, I wanted this project to be an open source project.

## Follow
 - News and updates on [Twitter](https://twitter.com/anton_reshetov).
 - [Discussions](https://github.com/massCodeIO/massCode/discussions).

## Other
You can also [download](https://github.com/antonreshetov/massCode) massCode v1.

## License

[AGPL-3.0](https://github.com/massCodeIO/massCode/blob/master/LICENSE)

Copyright (c) 2019-present, [Anton Reshetov](https://github.com/antonreshetov).