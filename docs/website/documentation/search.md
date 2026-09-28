---
title: Search
description: "Search snippets, notes, HTTP requests, spaces, and commands in massCode with scoped list search and Command Palette filters."
---

# Search

massCode has two search flows:

- Use the search field above a list to narrow the current space.
- Use the Command Palette to search across the app and add filters with the keyboard.

## Search the current list

The search field above a list searches the items in that space:

- Code searches snippets.
- Notes searches notes.
- HTTP searches requests.

Click the search field at the top of the list, or press <kbd>Cmd+F</kbd> on macOS and <kbd>Ctrl+F</kbd> on Windows and Linux.

List search respects the current sidebar context. If you select a folder, tag, or library view first, the search field narrows that selection instead of searching the whole space.

Examples:

- Select a Code tag, then search to find matching snippets inside that tag.
- Select a Notes folder, then search to find matching notes in that folder.
- Open Favorites, Trash, Tasks, Today, or Upcoming in Notes, then search inside that view.
- Select an HTTP folder, then search for matching requests inside that folder.

Clearing the search text keeps the same sidebar selection active.

## Search from the Command Palette

Open the Command Palette with <kbd>Cmd+P</kbd> on macOS or <kbd>Ctrl+P</kbd> on Windows and Linux.

The palette can search:

- snippets
- notes
- HTTP requests
- spaces
- commands
- recently opened items

Results are ranked with recent usage, so items you open often move higher over time.

## Scope the palette to a space

Use `@` to search in one space.

1. Open the palette.
2. Type `@`.
3. Select **Code**, **Notes**, or **HTTP**.
4. Type your search query.

You can also type the scope directly:

- `@code auth`
- `@notes release`
- `@http webhook`

Press <kbd>Esc</kbd> to leave the active scope and return to the full palette.

## Add filters in the palette

<AppVersion text=">=5.6" />

Use filter tokens when you want to narrow Command Palette search by folder or tag.

### Tags

Type `#` to show tag suggestions. Select a tag to add it as a chip.

Examples:

- `@code #vue composable`
- `@notes #backend migration`

Tags are available in Code and Notes.

### Folders

Type `/` to show folder suggestions. Select a folder to add it as a chip.

Examples:

- `@code /Shell docker`
- `@notes /Development backend`
- `@http /Webhooks stripe`

Nested folders can be selected by path, such as `/Work/API`.

## Work with search chips

The palette shows active scope and filters as chips in the input.

- Click the `x` on a chip to remove that scope or filter.
- Press <kbd>Backspace</kbd> in an empty input to remove one chip at a time.
- Removing a filter recalculates the search without clearing the remaining query.

You can combine a space, a folder, a tag, and text query when the combination applies to that space.

Example:

```text
Notes /Development #backend migration
```

This searches Notes for `migration` inside the Development folder with the backend tag.
