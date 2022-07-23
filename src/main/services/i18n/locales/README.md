# Locales

## Add new Locales
  - Make a duplicate of the `en` folder, then rename it to the necessary [two-letter locale code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).
  - Translate each value in each of the files.
  - Add new [prop](https://github.com/massCodeIO/massCode/blob/master/src/main/services/i18n/index.ts#L26) to i18n where the prop name corresponds to the name of the folder
```js
...
  // 'en' for prop & 'English' for value
  i18next.addResourceBundle(lng, 'language', {
    ...
    en: 'English',
    ...
  })
...
```
  - Add new [option](https://github.com/massCodeIO/massCode/blob/master/src/renderer/components/preferences/LanguagePreferences.vue#L42) for language selector where the name of the language corresponds to the name of the folder

```js
...
  // 'en' for label & value
  {
    label: i18n.t('preferences:language.en'),
    value: 'en'
  }
...
```

  - Make PR.
