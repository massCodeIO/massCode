<script setup lang="ts">
import FeaturesItem from './FeaturesItem.vue'
</script>

<template>
  <div class="features">
    <FeaturesItem title="Organization">
      Organize your snippets with multi-level folders and tags. Each snippet can
      contain multiple fragments (tabs), giving you fine-grained control over
      structure and grouping.
    </FeaturesItem>
    <FeaturesItem title="Editor">
      Built on
      <AppLink href="https://github.com/codemirror/codemirror5">
        CodeMirror
      </AppLink>
      with <code>.tmLanguage</code> grammars for syntax highlighting.
      <ul>
        <li>
          Supports over
          <AppLink
            href="https://github.com/github/linguist/blob/master/vendor/README.md"
          >
            600 grammars
          </AppLink>, with 160+ available out of the box.
        </li>
        <li>
          Integrated
          <AppLink href="https://prettier.io">
            Prettier
          </AppLink> for clean,
          consistent code formatting.
        </li>
      </ul>
    </FeaturesItem>
    <FeaturesItem title="Real-time HTML & CSS Preview">
      Write and instantly preview HTML and CSS snippets. Perfect for
      prototyping, testing ideas, or quick visual checks.
    </FeaturesItem>
    <FeaturesItem title="Markdown">
      Full Markdown support with syntax highlighting, tables, lists, and more.
      <ul>
        <li>
          Integrated
          <AppLink href="https://mermaid-js.github.io/mermaid/#">
            Mermaid
          </AppLink>
          for dynamic diagrams and charts.
        </li>
      </ul>
    </FeaturesItem>
    <FeaturesItem title="Presentation Mode">
      Turn a sequence of snippets into a presentation. Useful for classrooms,
      team meetings, conference talks, or simply walking through your own notes.
    </FeaturesItem>
    <FeaturesItem title="Mindmap">
      Generate mind maps from Markdown. Fast, intuitive, and ideal for
      structuring and visualizing ideas.
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
      </ul>
    </FeaturesItem>

    <FeaturesItem title="JSON Visualizer">
      Visualize and explore your JSON data with an interactive graph view.
      Perfect for quickly inspecting complex responses, APIs, or configuration
      files.
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
