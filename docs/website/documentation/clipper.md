---
title: Clipper
description: "Set up massCode Clipper locally to save selected text, pages, and links from Chrome, Firefox, or Safari into Code, Notes, and HTTP."
---

# Clipper

massCode Clipper saves web content from your browser into the local massCode app. Use it to send selected code to Code, selected text or readable page content to Notes, and pages or links to HTTP as `GET` requests.

The browser store version is not available yet. Until distribution is published, install the Clipper from a local build.

## Enable The Local API

The Clipper talks to massCode through the local Integration API.

1. Open massCode.
2. Open **Preferences**.
3. Go to **API**.
4. Keep the **API Port** value. The default is `4321`.
5. Enable **API integrations**.
6. Click **Generate token**.
7. Copy the generated token. The full token is shown only after generation.

If you change the API port, reload the app before using the new port from the browser extension.

## Build The Clipper

Run the build from the repository root:

```bash
pnpm integrations:clipper:build
```

This creates browser-specific builds:

- `integrations/clipper/dist/chrome`
- `integrations/clipper/dist/firefox`
- `integrations/clipper/dist/safari`

After installing the extension in a browser, open the Clipper popup, set the API port, paste the API token, and click **Save settings**.

## Chrome

1. Build the Chrome target:

```bash
pnpm integrations:clipper:build:chrome
```

2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select `integrations/clipper/dist/chrome`.

After rebuilding, return to `chrome://extensions` and reload the unpacked extension.

## Firefox

Firefox does not load an unpacked extension by selecting the `dist` folder.

1. Build the Firefox target:

```bash
pnpm integrations:clipper:build:firefox
```

2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `integrations/clipper/dist/firefox/manifest.json`.

The temporary extension stays installed until Firefox restarts. Use **Reload** on `about:debugging` after rebuilding.

## Safari

1. Build the Safari target:

```bash
pnpm integrations:clipper:build:safari
```

2. Open Safari.
3. Choose **Safari** > **Settings**.
4. Open **Advanced** and enable **Show features for web developers** or **Show Develop menu in menu bar**.
5. Open the **Developer** tab.
6. Enable **Allow unsigned extensions**.
7. Click **Add Temporary Extension...**.
8. Select `integrations/clipper/dist/safari`.
9. Enable the extension in Safari's **Extensions** settings if Safari does not enable it automatically.

Safari removes temporary extensions after 24 hours or when you quit Safari. Safari also resets **Allow unsigned extensions** when you quit the browser, so enable it again before the next local test session.

## Capture Content

Use the Clipper popup when you want to review or edit the item name before saving.

- **Code** saves selected text as a snippet. Select text on the page first.
- **Notes** saves selected text when available, otherwise it saves the readable page content.
- **HTTP** saves the current page URL as a `GET` request.

You can also right-click the page, selected text, or a link and choose **Save to massCode**. Context menu saves use the stored API port and token, then save to the target you choose in the menu.

## Troubleshooting

If the popup says it cannot read the active page, try a regular website tab. Browsers block extensions from reading internal pages such as browser settings, extension pages, and some store pages.

If saving fails, check that massCode is running, **API integrations** are enabled, the extension API port matches Preferences, and the token in the popup is the latest generated token.
