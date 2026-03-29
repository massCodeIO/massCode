# Layout

massCode uses a space-based layout.

The application has a narrow space rail on the left for switching between the main work areas:

- Code
- Notes
- Math
- Tools

## Code

The Code space uses a three-column layout:

- the first column shows the library, folders, and tags
- the second column shows snippets from the selected location
- the third column contains the editor

## Notes

The Notes space uses a three-column layout similar to Code:

- the first column shows the library, folders, and tags
- the second column shows notes from the selected location
- the third column contains the editor

## Math

The Math space provides a calculation notebook with:

- a sheets list on the left
- a calculator editor on the right

## Tools

The Tools space provides developer utilities with:

- a tool categories sidebar on the left
- the tool view on the right

## Sidebar Toggle

Toggle the sidebar visibility in Code and Notes spaces:

- Select **"View"** > **"Toggle Sidebar"** from the menu bar or press <kbd>Alt+Cmd+B</kbd> on macOS or <kbd>Alt+Ctrl+B</kbd> on Windows or Linux.

## Font Size

Adjust the editor font size in Code and Notes spaces:

- <kbd>Cmd+=</kbd> / <kbd>Ctrl+=</kbd> — increase
- <kbd>Cmd+-</kbd> / <kbd>Ctrl+-</kbd> — decrease
- <kbd>Cmd+0</kbd> / <kbd>Ctrl+0</kbd> — reset to default

## Preferences

Open application preferences:

- Press <kbd>Cmd+,</kbd> on macOS or <kbd>Ctrl+,</kbd> on Windows or Linux.

## Compact list mode

Code and Notes spaces support a compact list mode toggle that reduces the height of items in the snippet and notes lists, allowing you to see more items at once.

<img :src="withBase('/preview.png')">

<script setup>
import { withBase } from 'vitepress'
</script>
