# massCode Chrome Extension

Chrome Manifest V3 client for saving browser content into massCode.

## Setup

1. Open massCode preferences.
2. Go to API.
3. Enable API integrations and generate an API token.
4. Build the extension:

```bash
pnpm --dir integrations/chrome-extension build
```

5. Open `chrome://extensions`.
6. Enable Developer mode.
7. Load `integrations/chrome-extension/dist` as an unpacked extension.
8. Paste the API token into the extension popup.

## Scope

The extension talks to the local massCode integration API and does not read or
write the vault directly.

Supported MVP captures:

- selected text to Code;
- selected text to Notes;
- current page or selected link to HTTP as `GET`.
