---
title: Images
description: "Embed images in massCode Notes with standard markdown syntax, paste, and drag-and-drop."
---

# Images

Use images when a screenshot, diagram, or visual reference belongs next to the note text.

Images are rendered directly inside your note from standard markdown image syntax. For local images, paste an image from the clipboard or drag an image file into the editor. massCode stores the file in the vault and inserts the markdown for you.

```md
![image-name](masscode://notes-asset/generated-file-name.png)
```

You can also use a remote image URL:

```md
![Remote screenshot](https://example.com/screenshot.png)
```

The `masscode://notes-asset/` URL is resolved by massCode. Other Markdown apps may not display these local images directly.

## Managed Storage

<AppVersion text=">=5.9" />

Starting with massCode 5.9, newly pasted or dropped images are saved to `notes/.masscode/assets`. When you copy or synchronize Notes between devices, include the whole vault, including the hidden `notes/.masscode` directory. Copying only Markdown files leaves their local images behind.

::: warning Compatibility
Vaults with images in the managed `notes/.masscode/assets` path require a massCode version that supports this layout. Older versions may not display these images.
:::

::: info Automatic migration
When a note references an image from the legacy `notes/assets` directory, massCode migrates that referenced file to managed storage and updates the note automatically. Unreferenced files are left in place.
:::

- Paste or drag images in **Editor** and **Live Preview** modes.
- View images in **Live Preview** or **Preview** mode.
- Click an image block in editable modes to reveal and edit its markdown source.
- New pasted and dropped images can use `png`, `jpg`, or `jpeg`.
