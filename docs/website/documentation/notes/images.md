---
title: Images
description: "Embed images in massCode Notes with standard markdown syntax, paste, and drag-and-drop."
---

# Images

Use images when a screenshot, diagram, or visual reference belongs next to the note text.

Images are rendered directly inside your note from standard markdown image syntax. For local images, paste an image from the clipboard or drag an image file into the editor. massCode saves the file to `notes/assets` in your vault and inserts the markdown for you.

```md
![image-name](masscode://notes-asset/generated-file-name.png)
```

You can also use a remote image URL:

```md
![Remote screenshot](https://example.com/screenshot.png)
```

- Paste or drag images in **Editor** and **Live Preview** modes.
- View images in **Live Preview** or **Preview** mode.
- Click an image block in editable modes to reveal and edit its markdown source.
- Supported pasted and dropped formats: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, and `bmp`.
