---
title: Imports
description: "Import snippets, markdown notes, and API collections into massCode from VS Code, Raycast, SnippetsLab, GitHub Gists, Obsidian, OpenAPI, Postman, and Bruno."
---

# Imports

Imports bring existing work into massCode so your vault can start with the material you already use. Each import shows a preview before writing to disk, including the detected source, item counts, folders, tags, and warnings for skipped or unsupported source features.

## Code Imports

Use Code imports for snippet libraries and snippet-like exports.

Supported sources:

- **VS Code snippets JSON** - imports snippets from `.json` and `.code-snippets` files.
- **Raycast snippets JSON** - imports snippets from Raycast exports.
- **SnippetsLab JSON** - imports snippets, folders, tags, descriptions, and fragments from SnippetsLab exports.
- **Public GitHub Gist URLs** - imports files from public Gists into Code.

Open the **Code** space and choose **Import snippets** from the sidebar actions or Command Palette.

## Notes Imports

Use Notes imports to bring markdown notes into massCode.

Supported source:

- **Obsidian markdown folders** - imports markdown files into Notes while keeping folder structure where possible.

Open the **Notes** space and choose **Import notes** from the sidebar actions or Command Palette.

## HTTP Imports

Use HTTP imports when you already have API collections or specifications in another tool.

Supported sources:

- **OpenAPI JSON/YAML**
- **Postman Collection v2.1 JSON**
- **Postman Environment JSON**
- **Bruno OpenCollection YAML**
- **Bruno OpenCollection ZIP**

For the full HTTP workflow, see [Importing HTTP Collections](/documentation/http/importing).

## Preview And Warnings

Before anything is written to your vault, massCode reads the selected files or URL and shows a preview. Review the detected source, item counts, folders, tags, and warnings, then click **Import** to create the previewed items.

Warnings do not always block import. They usually mean that part of the source data has no equivalent in massCode, such as unsupported auth, disabled variables, attachments, smart groups, or source-specific metadata.
