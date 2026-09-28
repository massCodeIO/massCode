---
title: Clipper
description: "Set up massCode Clipper locally to save selected text, pages, and links from Chrome, Firefox, or Safari into Code, Notes, and HTTP."
---

# Clipper

massCode Clipper saves web content from your browser into the local massCode app. Use it to send selected code to Code, selected text or readable page content to Notes, and pages or links to HTTP as `GET` requests.

<p align="center">
<img :src="withBase('/clipper.png')" width="399" alt="massCode Clipper popup">
</p>

Install the Chrome version from the [Chrome Web Store](https://chromewebstore.google.com/detail/masscode-clipper/fkaaogdifollkhjbfoabbiocecehaaii). For Firefox, Safari, or local testing, download a build from this page or install the Clipper from a local repository build.

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

## Download The Clipper

Download the archive for your browser when you want to install the Clipper locally:

- [Chrome build](/clipper/downloads/clipper-chrome.zip)
- [Firefox build](/clipper/downloads/clipper-firefox.zip)
- [Safari build](/clipper/downloads/clipper-safari.zip)

Unzip the archive before loading it into the browser. Browsers do not load these local development builds directly from the ZIP file.

## Build The Clipper Locally

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

Install the published Chrome extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/masscode-clipper/fkaaogdifollkhjbfoabbiocecehaaii).

If you downloaded the archive, unzip `clipper-chrome.zip` first.

If you are building from the repository, build the Chrome target:

```bash
pnpm integrations:clipper:build:chrome
```

2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped Chrome build folder, or `integrations/clipper/dist/chrome` when building locally.

After rebuilding, return to `chrome://extensions` and reload the unpacked extension.

## Firefox

Firefox does not load an unpacked extension by selecting the `dist` folder.

If you downloaded the archive, unzip `clipper-firefox.zip` first.

If you are building from the repository, build the Firefox target:

```bash
pnpm integrations:clipper:build:firefox
```

Then:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` inside the unzipped Firefox build folder, or `integrations/clipper/dist/firefox/manifest.json` when building locally.

The temporary extension stays installed until Firefox restarts. Use **Reload** on `about:debugging` after rebuilding.

## Safari

If you downloaded the archive, unzip `clipper-safari.zip` first.

If you are building from the repository, build the Safari target:

```bash
pnpm integrations:clipper:build:safari
```

Then:

1. Open Safari.
2. Choose **Safari** > **Settings**.
3. Open **Advanced** and enable **Show features for web developers** or **Show Develop menu in menu bar**.
4. Open the **Developer** tab.
5. Enable **Allow unsigned extensions**.
6. Click **Add Temporary Extension...**.
7. Select the unzipped Safari build folder, or `integrations/clipper/dist/safari` when building locally.
8. Enable the extension in Safari's **Extensions** settings if Safari does not enable it automatically.

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

<script setup>
import { withBase } from 'vitepress'
</script>
