---
title: JSON Diff
description: "Compare two JSON documents side by side in massCode with validation, filters, and a tree diff."
---

# JSON Diff

<AppVersion text=">=5.1" />

JSON Diff lets you compare two JSON documents side by side without leaving massCode. It is useful for checking API responses, fixture changes, configuration edits, and generated JSON payloads.

## Where to find it

Open **Tools** in the left rail, then go to **Compare** → **JSON Diff**.

## What it does

- Shows the original and modified JSON in two editors
- Validates each side independently
- Formats valid JSON on paste and blur
- Builds a tree-based diff for nested objects and arrays
- Highlights added, removed, and modified values
- Filters the diff by change type
- Keeps both input editors scrolled in sync
- Uses the same editor font settings as the main code editor

## How to use it

1. Paste the original JSON into the left editor.
2. Paste the modified JSON into the right editor.
3. Review the diff tree below the editors.
4. Use the checkboxes to focus on added, removed, or modified nodes.
5. Expand or collapse nested objects and arrays as needed.

## Notes

- Both inputs must contain valid JSON before the diff viewer appears.
- Validation errors are shown under each editor separately.
- If only one side is filled, the tool stays in the empty state instead of guessing missing data.
- Array move visualization is not exposed as a separate state. In this version, the tool prefers predictable output over compact move semantics.
