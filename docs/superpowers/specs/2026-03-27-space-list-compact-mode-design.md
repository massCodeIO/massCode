# Space List Compact Mode Design

## Summary

Add a shared compact list mode for every space that exposes a list (`code`, `notes`, `math`). In compact mode, each list item renders the title and date on a single row instead of using a two-line layout.

## Goals

- Provide one shared toggle that affects all list-based spaces.
- Expose the toggle in the OS `View` menu only when the active space supports a list.
- Keep selection, context menus, rename flows, and scroll restoration unchanged.

## Non-goals

- No per-space compact mode preferences.
- No changes to sorting, filtering, or persisted content.
- No new renderer routes or IPC handlers beyond the menu toggle wiring.

## Design

### Shared state

Store a single `compactListMode` boolean in `store.app`. Expose it from existing renderer composables used by list-based spaces so both UI and main-menu context can read the same value.

### Main menu

Extend `MainMenuViewContext` with:

- `canToggleCompactMode`
- `isCompactMode`

`code`, `notes`, and `math` set `canToggleCompactMode` to `true`. Other spaces set it to `false`. The `View` menu gets a checkbox item that sends `main-menu:toggle-compact-mode`.

### Renderer UI

- `code`: update snippet list item layout and virtual row height.
- `notes`: update note list item layout and virtual row height.
- `math`: update sheet list item layout and spacing.

In compact mode, items stay functionally identical but collapse to a single line with the name on the left and formatted date on the right.

## Testing

- Add/extend menu tests to cover the new `View -> Compact Mode` checkbox and its visibility/checked state.
- Add/extend renderer main-menu context tests so supported spaces expose compact-mode state correctly.
- Run targeted tests and lint only on changed files.
