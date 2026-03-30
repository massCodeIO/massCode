---
title: Mind Maps
description: "Turn markdown headings into interactive mind maps in massCode and export them as PNG or SVG."
---

# Mindmap

Mindmap turns the structure of your note into a visual outline. It is most useful for planning, presenting a hierarchy, or checking whether a long note has a clear structure.

The map is generated from the markdown structure of the current note, with headings forming the main branches.

- Select **"View"** > **"Mindmap"** from the menu bar or press <kbd>Shift+Cmd+I</kbd> on macOS or <kbd>Shift+Ctrl+I</kbd> on Windows or Linux.
- Interactive zoom controls for navigating the map.
- Export to **PNG** or **SVG**.

<script setup>
import { withBase } from 'vitepress'
</script>

<img :src="withBase('/mindmap.png')">
