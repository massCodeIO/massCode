# massCode Clipper Privacy

massCode Clipper sends captured browser content only to the local massCode API
configured in the extension popup.

## Data processed

Depending on the selected capture target, the extension may read:

- selected page text or HTML;
- extracted page title, URL, favicon URL, and readable page content;
- selected link URL;
- API port and Integration API token stored in browser extension storage.

## Data sharing

The extension does not send captured content to massCode Cloud or third-party
services. Save requests are sent to `http://localhost:<port>/captures/` or
`http://127.0.0.1:<port>/captures/`.

## Token storage

The Integration API token is stored in browser extension local storage. massCode
stores only a hash of the token in app preferences. Revoke the token from
massCode Preferences -> API to stop integration access.

## Browser permissions

Permissions are used to read the active tab on user action, create context menu
entries, run the page extractor, and save extension settings.

## Store publishing

Browser stores may require a public URL version of this notice before
publishing.
