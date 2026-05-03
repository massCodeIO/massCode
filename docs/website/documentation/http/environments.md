---
title: HTTP Environments
description: "Use HTTP environments in massCode to manage reusable variables for local, staging, and production API requests."
---

# Environments

Environments store reusable variables for requests. Use them for values that change between local, staging, and production APIs, such as base URLs, user IDs, organization IDs, and tokens.

<img :src="withBase('/http-envs.png')">

## Variables

Use variables with double braces:

```text
{{apiUrl}}/v1/users/{{userId}}/sessions
```

The URL field keeps variables visible while you edit. Preview and request execution resolve variables from the active environment.

Variables can be used in:

- URL
- params
- headers
- body
- auth fields

## Active Environment

Use the **Environments** panel below folders to choose the active environment.

Select **No environment** when you want requests to keep variables unresolved. This is useful when you are editing templates or copying a request without applying local values.

## Managing Environments

Open **Manage** from the Environments panel to create environments and edit variables.

Each environment has:

- a name
- a key-value table of variables

The active environment is stored as part of the HTTP space state.

<script setup>
import { withBase } from 'vitepress'
</script>
