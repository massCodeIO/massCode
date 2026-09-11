---
title: Collections & Folders
description: "Organize HTTP requests and share authentication, headers, variables, scripts, and tests through collection and folder scopes."
---

# Collections & Folders

A collection is a top-level HTTP folder. Nested folders group related operations and can override shared settings. For example, put a shop API's base URL, authorization, and common headers on its collection, then keep `Products`, `Customers`, and `Orders` in separate folders.

## Create and edit a collection

<AppVersion text=">=5.11" />

1. Choose **New collection** in the sidebar **+** menu or use the **New HTTP collection** command palette action.
2. Name it for the API or workflow.
3. Select the collection itself in the tree to open its editor. Expanding the arrow only reveals its contents.
4. Use **Overview** for Markdown documentation; add common **Headers**, **Auth**, and **Variables** in their tabs.
5. Click **Save** to apply the shared configuration. If you leave with edits, choose Save, Discard, or Cancel.
6. Create folders and requests from the collection's context menu.

The Overview dashboard shows request and folder counts, a breakdown by method, recent request activity, and the last available run result. Click a recent request entry to inspect its saved snapshot. Use the description to record setup requirements, example values, and the intended run order.

<img :src="withBase('/http-collection.png')" alt="Northstar Checkout collection overview with three passing runner steps and recent requests">

Nested folders have the same shared-configuration editor. Save parent changes before sending child requests or preparing a runner snapshot: children use saved parent configuration. Request and collection names are saved separately from content drafts.

<img :src="withBase('/http-collection-headers.png')" alt="Shared Northstar collection headers inherited by its requests">

## Inheritance

Settings follow the path **collection → outer folder → inner folder → request**.

| Setting | How scopes combine |
| --- | --- |
| Headers | Enabled headers are inherited. A closer scope replaces a header with the same case-insensitive name. Duplicate names within that closer scope are combined in order, with commas, or semicolons for `Cookie`. |
| Authentication | **Inherit from parent** uses the effective parent auth. An explicit method replaces it; **None** stops auth inheritance. |
| Variables | An enabled variable in a closer folder replaces the same collection variable. The active environment then overrides these defaults, and Session overrides the environment. |
| Assertions | Parent checks run together with child checks; adding a same-named check does not replace a parent assertion. |
| Extraction | A closer extraction with the same variable name replaces the parent rule. |
| Scripts | Each scope keeps its own trusted code. Parent pre-request scripts run before child scripts. Post-response order depends on the collection's origin, as described below. |

A disabled row is ignored; disabling a local header does not remove an enabled inherited header. To change a shared header, enter an enabled local override or edit the parent.

The combined effective request can have at most **100 assertions and 100 extraction rules**, including inherited rules. Reduce parent or child rules if the effective total exceeds the limit.

### Script execution order

For a native massCode collection, pre-request code runs collection first, then nested folders, then the request. Post-response code runs **request first**, then folders from the inside out, then the collection.

Imported Postman collections preserve Postman's **parent-first** post-response order: collection, folders, request. Editing the imported collection updates that shared scope; its scripts are not flattened into independent request copies. Bruno import has separate conversion behavior; see [Inherited scripts](./importing#inherited-scripts).

Review and trust scripts in every scope that contains them. See [JavaScript Scripts](./scripts) for the API and rollback behavior.

## Organize your library

- **Collections** shows the nested tree and opens shared configuration when you select a folder.
- Requests without a folder appear together in the collection tree.
- The **star button** beside search filters the tree to favorite requests marked through their context menu.
- **Environments** lets you select reusable values for the current API.
- **Trash** contains deleted requests until you restore or permanently delete them.

Use search at the top of the sidebar to filter requests, collections, environments, and Trash. Collapse sections or drag their dividers to make room for the items you need. Select a matching request to open its editor. Drag requests into folders and drag folders to rearrange or nest them. Moving a request changes its parent configuration, so review its inherited auth, headers, variables, and scripts before sending again.

Right-click a request to add/remove a favorite, duplicate it, copy its saved request preview, copy its internal link, reveal the Markdown file in Finder/file manager, or move it to Trash. The editor's preview reflects the current draft; the context-menu copy action loads the saved request. An internal `masscode://` link opens that item in massCode and requires the corresponding local vault.

### Trash and restore

Use **Restore** in Trash to return a request without a folder. Its saved request content and runtime rules remain, but it no longer has its previous folder inheritance. Move it back to the intended collection if needed. Deleting an item from Trash or using **Empty Trash** permanently removes it; check the selection before confirming.

Cloud-offloaded files must finish downloading before content actions such as copy, duplicate, save, or send become available. Revealing a file helps locate it in your sync provider.

## Custom icons

Right-click a collection/folder and choose **Set Icon** for a Material or Lucide icon. **Remove Icon** restores the default.

<AppVersion text=">=5.9" />

The picker also supports native emoji and JPG/PNG uploads. Preview an uploaded image before applying it; massCode center-crops and resizes it to 128×128.

## Keyboard workflow

Save content with <kbd>⌘+S</kbd> / <kbd>Ctrl+S</kbd>. Send the selected HTTP request with <kbd>⌘+Enter</kbd> / <kbd>Ctrl+Enter</kbd>. The command palette offers context-aware HTTP actions, including creating a child folder and opening the runner for the current collection or folder.

<script setup>
import { withBase } from 'vitepress'
</script>
