# Locales

## File Structure

Locales are stored in directories named according to the [BCP 47 language tag standard](https://en.wikipedia.org/wiki/IETF_language_tag) which uses ISO 639 language codes and ISO 3166-1 country codes.

We use the format: `language_REGION` where:
- `language` is a two-letter [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) (lowercase)
- `REGION` is a two-letter [ISO 3166-1 country code](https://en.wikipedia.org/wiki/ISO_3166-1) (uppercase)

Examples:
- `en_US` - English (United States)
- `en_GB` - English (United Kingdom)
- `pt_BR` - Portuguese (Brazil)
- `pt_PT` - Portuguese (Portugal)
- `ru_RU` - Russian (Russia)
- `zh_CN` - Chinese (China)

### Main Files:

- **ui.json** - User interface elements
- **menu.json** - Application menus
- **messages.json** - Dialogs, confirmation prompts, warnings, errors, and descriptions
- **preferences.json** - Application settings and preferences
- **devtools.json** - Developer tools and utilities

## Organization Principles

1. **Modularity**: Separate keys by functional blocks
2. **Hierarchy**: Use nested objects to group related keys
3. **Consistency**: Maintain the same structure across files
4. **Context**: Place keys in context-appropriate files

## Adding New Keys

When adding new localization keys:

1. Determine which functional block your key belongs to
2. Choose the appropriate file based on the content type
3. Follow the existing structure and naming conventions
4. Add the key to all language packs

## Adding New Languages

1. Make a duplicate of the `en_US` (or other base language) directory, then rename it according to the language_REGION format (e.g., `ru_RU`, `pt_BR`)
2. Translate all values in all files
3. Add a new property to i18n where the property name corresponds to the directory name:

```javascript
// Property name should match directory name
export const language = {
  en_US: 'English',
  ru_RU: 'Русский',
  pt_BR: 'Português (Brasil)',
  // new language
}
```

4. Create a PR

When creating a PR, please follow this commit message format:
```
feat(i18n): add <language_code> translation
```

For example:
```
feat(i18n): add zh_CN translation
fix(i18n): pt_BR translation
```

## Translation Guidelines

1. Preserve the original formatting and placeholders (e.g., `{{count}}`, `{{name}}`)
2. Consider the context in which the phrase is used
3. Maintain a consistent style and terminology throughout the translation
4. Verify that your translation fits the UI components (text length, line breaks)
