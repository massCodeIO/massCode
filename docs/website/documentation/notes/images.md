---
title: Images
description: "Embed images in massCode Notes with standard markdown syntax, paste, and drag-and-drop."
---

# Images

Use images when a screenshot, diagram, or visual reference belongs next to the note text.

Images are rendered directly inside your note from standard markdown image syntax. For local images, paste an image from the clipboard or drag an image file into the editor. massCode saves new files to `notes/.masscode/assets` in your vault and inserts the markdown for you.

```md
![image-name](masscode://notes-asset/generated-file-name.png)
```

You can also use a remote image URL:

```md
![Remote screenshot](https://example.com/screenshot.png)
```

The `masscode://notes-asset/` URL is resolved by massCode. Other Markdown apps may not display these local images directly. When you copy or synchronize Notes between devices, include the whole vault, including the hidden `notes/.masscode` directory. Copying only Markdown files leaves their local images behind.

Vaults with images in the managed `notes/.masscode/assets` path require a massCode version that supports this layout. Older versions may not display these images.

- Paste or drag images in **Editor** and **Live Preview** modes.
- View images in **Live Preview** or **Preview** mode.
- Click an image block in editable modes to reveal and edit its markdown source.
- New pasted and dropped images can use `png`, `jpg`, or `jpeg`.
