<script setup lang="ts">
import FeaturesItem from './FeaturesItem.vue'
</script>

<template>
  <div class="features">
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
      Keep technical notes, task notes, docs, and drafts next to your snippets.
      Write in Markdown with live preview, add status, priority, and due dates
      to task notes, organize with folders and tags, and use Mermaid diagrams,
      mindmaps, or fullscreen presentation mode when you need more structure.
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
    <FeaturesItem title="Imports">
      Bring existing libraries into your local vault. Import snippets from VS
      Code, Raycast, SnippetsLab, and public GitHub Gists, or import Obsidian
      markdown folders into Notes with a preview before writing.
    </FeaturesItem>
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
.features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 24px 0;
}

@media (min-width: 768px) {
  .features {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 24px;
  }

  .features > :nth-child(-n + 2) {
    grid-column: span 3;
  }

  .features > :nth-child(n + 3):nth-child(-n + 5) {
    grid-column: span 2;
  }

  .features > :nth-child(n + 6) {
    grid-column: span 3;
  }
}

@media (min-width: 1024px) {
  .features {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }

  .features > :nth-child(-n + 2) {
    grid-column: span 6;
  }

  .features > :nth-child(n + 3):nth-child(-n + 5) {
    grid-column: span 4;
  }

  .features > :nth-child(n + 6) {
    grid-column: span 3;
  }
}
</style>
