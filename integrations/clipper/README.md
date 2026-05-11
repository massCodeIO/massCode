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

## Scope

The extension talks to the local massCode integration API and does not read or
write the vault directly.

Supported MVP captures:

- selected text to Code;
- selected text to Notes;
- current page to Notes;
- current page or selected link to HTTP as `GET`.
