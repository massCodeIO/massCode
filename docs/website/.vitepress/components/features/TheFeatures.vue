<script setup lang="ts">
import FeaturesItem from './FeaturesItem.vue'
</script>

<template>
  <div class="spaces">
    <FeaturesItem title="Code Snippets">
      Build a reusable code library across projects and languages. Organize
      snippets with folders, tags, and fragments, then edit them with
      <AppLink href="https://github.com/codemirror/codemirror5">
        CodeMirror
      </AppLink>
      , format them with
      <AppLink href="https://prettier.io">
        Prettier
      </AppLink>
      , preview HTML & CSS in real time, inspect JSON visually, and export
      polished screenshots when you need to share code.
    </FeaturesItem>
    <FeaturesItem title="Notes">
      Keep technical notes, docs, and drafts next to your snippets. Write in
      Markdown with live preview, folders, tags, Mermaid diagrams, mindmaps
      generated from headings, and fullscreen presentation mode for sharing your
      work.
    </FeaturesItem>
    <FeaturesItem title="HTTP Client">
      Save and send API requests without leaving your workspace. Organize
      requests in folders, switch environments, preview outgoing HTTP or cURL,
      inspect responses, and import collections from OpenAPI, Postman, and
      Bruno.
    </FeaturesItem>
    <FeaturesItem title="Math Notebook">
      Do the quick calculations that usually break your flow. Natural-language
      math handles inputs like <code>time in Tokyo</code>,
      <code>density of honey</code>, and
      <code>$500 invested $1,500 returned</code> for currencies, time zones,
      unit conversion, finance, and date math.
    </FeaturesItem>
    <FeaturesItem title="Developer Tools">
      Handle the small developer tasks that usually send you to a browser tab.
      Convert, encode, hash, and generate data right inside massCode with tools
      for JSON, Base64, URLs, colors, passwords, UUIDs, and more.
    </FeaturesItem>
  </div>
  <div class="extras">
    <FeaturesItem title="Integrations">
      Bring your snippet library into the tools you already use.
      <AppLink
        href="https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant"
      >
        VS Code Extension
      </AppLink>
      for searching and inserting snippets, and
      <AppLink href="https://www.raycast.com/antonreshetov/masscode">
        Raycast Extension
      </AppLink>
      for quick access from anywhere.
    </FeaturesItem>
    <FeaturesItem title="Open & Local">
      Keep your data on your machine and in your control. Notes and snippets are
      stored as plain Markdown files, so syncing with iCloud, Dropbox, or Git
      stays simple and portable.
    </FeaturesItem>
    <FeaturesItem title="Localization">
      Use massCode in the language you are most comfortable with. The app is
      available in 15 languages, including English, Deutsch, Español, Français,
      Русский, 日本語, and 中文.
    </FeaturesItem>
  </div>
</template>

<style scoped>
.spaces {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 24px 0 8px;
}

.extras {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 8px 0 24px;
}

@media (min-width: 768px) {
  .spaces {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 24px;
    padding: 24px 0 12px;
  }

  .extras {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    padding: 12px 0 24px;
  }

  .spaces > :nth-child(-n + 2) {
    grid-column: span 3;
  }

  .spaces > :nth-child(n + 3) {
    grid-column: span 2;
  }
}

@media (min-width: 1024px) {
  .extras {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
