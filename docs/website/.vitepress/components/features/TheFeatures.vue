<script setup lang="ts">
import FeaturesItem from './FeaturesItem.vue'
</script>

<template>
  <div class="features">
    <FeaturesItem title="Code Snippets">
      Organize your snippets with multi-level folders and tags. Each snippet can
      contain multiple fragments (tabs). Built on
      <AppLink href="https://github.com/codemirror/codemirror5">
        CodeMirror
      </AppLink>
      with 160+
      <AppLink
        href="https://github.com/github/linguist/blob/master/vendor/README.md"
      >
        grammars
      </AppLink>, <AppLink href="https://prettier.io">
        Prettier
      </AppLink> formatting,
      real-time HTML & CSS preview, and JSON visualizer.
    </FeaturesItem>
    <FeaturesItem title="Notes">
      An Obsidian-like markdown editor built right into massCode. Write and
      organize notes with folders, tags, live preview, mindmaps, and
      presentation mode.
    </FeaturesItem>
    <FeaturesItem title="Math Notebook">
      A calculator notepad with natural language expressions. Currencies,
      timezones, unit conversions, finance calculations, cooking conversions,
      and more.
    </FeaturesItem>
    <FeaturesItem
      title="Developer Tools"
      style="grid-column: 1 / 3"
    >
      Handy built-in utilities for everyday dev tasks:
      <ul>
        <li>
          <strong>Text Tools</strong>: Case Converter, Slug Generator, URL
          Parser
        </li>
        <li>
          <strong>Crypto & Security</strong>: Hash/HMAC, Password Generator,
          UUID
        </li>
        <li>
          <strong>Encoders/Decoders</strong>: URL, Base64, JSON ⇄ TOML/XML/YAML,
          Text ⇄ ASCII/Binary/Unicode, Color Converter
        </li>
        <li><strong>Generators</strong>: JSON Generator, Lorem Ipsum</li>
      </ul>
    </FeaturesItem>
    <FeaturesItem title="Integrations">
      Extend your workflow with:
      <ul>
        <li>
          <AppLink
            href="https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant"
          >
            VS Code Extension
          </AppLink>: zen mode snippet search, instant insertion, and save selected code
          as snippets.
        </li>
        <li>
          <AppLink href="https://www.raycast.com/antonreshetov/masscode">
            Raycast Extension
          </AppLink>: quick snippet access directly from Raycast.
        </li>
      </ul>
    </FeaturesItem>
    <FeaturesItem title="Beautiful Screenshots">
      Export snippets as polished images with customizable themes and
      backgrounds.
    </FeaturesItem>
    <FeaturesItem title="Localization">
      massCode is available in Čeština, Deutsch, Ελληνικά, English, Español,
      French, 日本語, Português (Brasil), Română, Русский, Türkçe, Українська,
      中文 (简体), 中文 (繁體) & 中文 (繁體 香港特別行政區) languages.
    </FeaturesItem>
  </div>
</template>

<style scoped>
.features {
  padding: 24px 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
</style>
