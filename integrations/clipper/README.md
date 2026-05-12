# massCode Clipper

Browser extension client for saving web content into massCode.

## Setup

1. Open massCode preferences.
2. Go to API.
3. Enable API integrations and generate an API token.
4. Build the extension:

```bash
pnpm integrations:clipper:build
```

5. Open `chrome://extensions`.
6. Enable Developer mode.
7. Load `integrations/clipper/dist/chrome` as an unpacked extension.
8. Paste the API token into the extension popup.

## Browser targets

The Clipper uses shared source code with browser-specific manifests:

```bash
pnpm integrations:clipper:build:chrome
pnpm integrations:clipper:build:firefox
pnpm integrations:clipper:build:safari
```

Production outputs are written to:

- `dist/chrome`
- `dist/firefox`
- `dist/safari`

Store packages are written to `builds/`:

```bash
pnpm integrations:clipper:package
pnpm integrations:clipper:package:chrome
pnpm integrations:clipper:package:firefox
pnpm integrations:clipper:package:safari
```

`package.json` is the version source of truth. Browser manifests are copied
from `manifests/` during build, and the output `manifest.json` receives the
package version automatically.

## Local Firefox loading

Firefox does not load an unpacked extension by selecting the `dist` folder.

1. Build the Firefox target:

```bash
pnpm integrations:clipper:build:firefox
```

2. Open `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on`.
4. Select `integrations/clipper/dist/firefox/manifest.json`.

The extension stays installed until Firefox restarts. Use `Reload` on
`about:debugging` after rebuilding.

## Local Safari loading

1. Build the Safari target:

```bash
pnpm integrations:clipper:build:safari
```

2. Open Safari settings and enable developer features.
3. In Safari developer settings, enable unsigned extensions.
4. Use `Add Temporary Extension...`.
5. Select `integrations/clipper/dist/safari`.

Safari temporary extensions are removed after Safari exits or after the browser
temporary extension timeout expires. Store distribution requires a Safari Web
Extension app package through Xcode and App Store Connect.

## Privacy

See `PRIVACY.md` for the Clipper privacy note used for store review.

## Scope

The extension talks to the local massCode integration API and does not read or
write the vault directly.

Supported MVP captures:

- selected text to Code;
- selected text to Notes;
- current page to Notes;
- current page or selected link to HTTP as `GET`.
