---
title: Importing HTTP Collections
description: "Import OpenAPI, Postman, and Bruno collections into the massCode HTTP space."
---

# Importing Collections

<AppVersion text=">=5.3" />

Use import when you already have API collections or specifications in another tool and want to bring them into the HTTP space without recreating requests by hand.

<img :src="withBase('/http-import.png')">

## Supported Formats

HTTP import supports:

- **OpenAPI JSON/YAML** - generates requests from OpenAPI operations.
- **Postman Collection v2.1 JSON** - imports folders, requests, params, headers, bodies, descriptions, and supported auth.
- **Postman Environment JSON** - optional environment file imported together with a Postman collection.
- **Bruno OpenCollection YAML** - imports single-file Bruno OpenCollection exports.
- **Bruno OpenCollection ZIP** - imports zipped Bruno OpenCollection exports.

## Opening Import

Open the **HTTP** space and click the import button in the HTTP sidebar header. The import button is next to the **HTTP Client** title because importing can create folders, requests, and environments.

## Selecting Files

Use either method in the import dialog:

- Click **Choose files** and select one or more files from disk.
- Drag files into the drop zone.

For Postman, select the collection JSON and, optionally, the environment JSON in the same import dialog.

## Preview

After files are selected, massCode reads them and shows a preview before anything is written to your vault.

The preview includes:

- number of collections
- number of requests
- number of environments
- collection names with folder and request counts
- environment names with variable counts
- warnings for skipped or unsupported features

Click **Import** to create the previewed items in the HTTP space.

## Where Imported Data Goes

Each imported collection becomes a new top-level folder in the HTTP space. Nested folders and requests are created under that collection folder.

Imported environments are added to the **Environments** panel. Environment variables are stored as plain text in your vault, the same as variables created manually in HTTP.

## Warnings

Some external client features do not have an equivalent in the current HTTP space model. When that happens, import keeps the request data it can represent and shows a warning.

Common warnings include:

- runtime scripts skipped
- assertions skipped
- disabled environment variables skipped
- unsupported auth skipped or converted when possible

Requests and environments are still importable when warnings are shown.

<script setup>
import { withBase } from 'vitepress'
</script>
