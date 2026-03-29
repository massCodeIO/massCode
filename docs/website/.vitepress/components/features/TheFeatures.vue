<script setup lang="ts">
import FeaturesItem from './FeaturesItem.vue'
</script>

<template>
  <div class="spaces">
    <FeaturesItem title="Code Snippets">
      Organize code with multi-level folders, tags, and multi-tab fragments.
      Built on
      <AppLink href="https://github.com/codemirror/codemirror5">
        CodeMirror
      </AppLink>
      with 160+ syntax grammars and
      <AppLink href="https://prettier.io">
        Prettier
      </AppLink> formatting.
      Real-time HTML & CSS preview for rapid prototyping, JSON visualizer for
      exploring complex data structures, and beautiful screenshot export with
      customizable themes.
    </FeaturesItem>
    <FeaturesItem title="Notes">
      An Obsidian-like markdown editor with live preview, folders, and tags.
      Write documentation, keep a dev journal, or draft ideas with full Mermaid
      diagram support, mindmap generation from headings, and presentation mode
      for sharing your notes as slide decks.
    </FeaturesItem>
    <FeaturesItem title="Math Notebook">
      A smart notepad where <code>time in Tokyo</code>,
      <code>density of honey</code>, and
      <code>$500 invested $1,500 returned</code> just work. 166+ currencies,
      timezone lookups, unit conversions, finance formulas, and more.
    </FeaturesItem>
    <FeaturesItem title="Developer Tools">
      Built-in utilities for everyday tasks: case converter, slug generator, URL
      parser, hash/HMAC generators, password and UUID generators, Base64/URL
      encoders, JSON to YAML/TOML/XML converters, color converter, and text
      generators.
    </FeaturesItem>
  </div>
  <div class="extras">
    <FeaturesItem title="Integrations">
      <AppLink
        href="https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant"
      >
        VS Code Extension
      </AppLink>
      for snippet search and insertion.
      <AppLink href="https://www.raycast.com/antonreshetov/masscode">
        Raycast Extension
      </AppLink>
      for quick access.
    </FeaturesItem>
    <FeaturesItem title="Open & Local">
      Local-first by design. Your notes and snippets stay on your machine as
      plain Markdown files. Sync with iCloud, Dropbox, or Git, and keep full
      version history.
    </FeaturesItem>
    <FeaturesItem title="Localization">
      Available in 15 languages including English, Deutsch, Español, Français,
      Русский, 日本語, 中文, and more.
    </FeaturesItem>
  </div>
</template>

<style scoped>
.spaces {
  padding: 24px 0 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.extras {
  padding: 12px 0 24px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
</style>
