# Notes

<AppVersion text=">=5.0" />

Dedicated space for writing and organizing markdown documents. An Obsidian-like markdown editor built into massCode.

Access the Notes space by clicking the **Notes** icon in the space rail. The interface uses a three-column layout: sidebar (library, folders, tags), notes list, and editor.

## Creating a Note

Follow one of the following steps:

- Select **"File"** > **"New Note"** from the menu bar.
- Press <kbd>Cmd+N</kbd> on macOS or <kbd>Ctrl+N</kbd> on Windows or Linux.

## Editor Modes

Switch between three editor modes using the controls at the top of the editor panel.

- **Editor** — raw markdown editing.
- **Live Preview** — split view with source and rendered preview side by side.
- **Preview** — read-only rendered view.

## Editor Features

The editor is built on CodeMirror 6 and includes:

- Syntax highlighting for fenced code blocks
- Smart list indentation with automatic ordered list renumbering
- Tab / Shift-Tab indentation
- Table navigation between cells
- Mermaid diagram support
- Image embedding
- Callout blocks

## Library

The library is located in the first column and consists of the following system sections:

- **Inbox** — notes without a folder.
- **Favorites** — notes marked as favorites for quick access.
- **All Notes** — all notes across all folders.
- **Trash** — deleted notes. Call the context menu by right-clicking on **"Trash"** and selecting **"Empty Trash"** to permanently remove them.

::: warning
Emptying the trash will result in the complete removal of notes. This action cannot be undone.
:::

## Folders

Notes can be organized into hierarchical folders.

### Adding a Folder

Follow one of the following steps:

- Click **"+"** button opposite **"FOLDERS"** in the sidebar.
- Select **"File"** > **"New Folder"** from the menu bar.
- Press <kbd>Shift+Cmd+N</kbd> on macOS or <kbd>Shift+Ctrl+N</kbd> on Windows or Linux.

### Moving to Folder

Drag and drop the required folder to another folder.

### Renaming and Deleting

Call the context menu by right-clicking on the folder and selecting **"Rename"** or **"Delete"**.

### Custom Icons

Call the context menu by right-clicking on the folder and select **"Set Custom Icon"**.

### Moving Notes

Drag and drop notes between folders.

## Tags

Tags provide an additional way to organize notes. Unlike folders, a note can have many tags.

### Adding a Tag

Select the note, then enter a tag name in the **"Add Tag"** field. Existing tags will appear in a pop-up menu for selection.

### Filtering by Tag

Click on a tag in the sidebar to filter notes by that tag.

## Mindmap

Generate mind maps from note headings.

- Select **"View"** > **"Mindmap"** from the menu bar or press <kbd>Shift+Cmd+I</kbd> on macOS or <kbd>Shift+Ctrl+I</kbd> on Windows or Linux.
- Interactive zoom controls for navigating the map.
- Export to **PNG** or **SVG**.

## Presentation Mode

Present notes in fullscreen as a slide deck.

- Select **"View"** > **"Presentation"** from the menu bar or press <kbd>Shift+Cmd+P</kbd> on macOS or <kbd>Shift+Ctrl+P</kbd> on Windows or Linux.
- Navigate slides with arrow keys.
- Laser pointer feature for highlighting content during presentations.
- Press <kbd>Esc</kbd> to exit.

## Editor Preferences

Customize the editor appearance and behavior in preferences:

- **Font size** and **font family**
- **Code font family** — separate setting for code blocks
- **Line height** — Compact, Default, or Relaxed
- **Indent size**
- **Limit width** — toggle to constrain the editor width
- **Line numbers** — toggle to show or hide line numbers

## Search

Full-text search across note names and content.

Follow one of the following steps:

- Click on the search entry field at the top of the second column.
- Press <kbd>Cmd+F</kbd> on macOS or <kbd>Ctrl+F</kbd> on Windows or Linux.
