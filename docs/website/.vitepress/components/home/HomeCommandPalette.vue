<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { ref } from 'vue'
import HomeCard from './HomeCard.vue'
import HomeShortcutDemo from './HomeShortcutDemo.vue'

const palettePhase = ref<'search' | 'commands'>('search')
</script>

<template>
  <HomeCard
    as="article"
    glow="right"
    class="palette"
    aria-labelledby="palette-title"
  >
    <div class="section-copy">
      <span class="section-label">COMMAND PALETTE</span>
      <h3 id="palette-title">
        A few keystrokes away.
      </h3>
      <p>
        Find snippets, notes, and requests from anywhere in massCode. Switch
        spaces, create something new, or run a command—all from your keyboard.
      </p>
      <a :href="withBase('/documentation/command-palette')">Meet the Command Palette <ArrowRight
        :size="16"
        aria-hidden="true"
      /></a>
      <HomeShortcutDemo @phase-change="palettePhase = $event" />
    </div>
    <div class="palette-image">
      <img
        :src="withBase('/home-command-palette-search.png')"
        :class="{ 'is-active': palettePhase === 'search' }"
        :aria-hidden="palettePhase !== 'search'"
        alt="Command Palette search with recent items and actions"
        loading="lazy"
        width="1280"
        height="880"
      >
      <img
        :src="withBase('/home-command-palette-commands.png')"
        :class="{ 'is-active': palettePhase === 'commands' }"
        :aria-hidden="palettePhase !== 'commands'"
        alt="Command Palette in command mode"
        loading="lazy"
        width="1280"
        height="880"
      >
    </div>
  </HomeCard>
</template>

<style scoped>
h3 {
  margin-top: 14px;
  font-size: clamp(34px, 3.8vw, 48px);
  line-height: 1.12;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--home-muted);
}
p {
  margin-top: 18px;
  color: var(--home-muted);
  font-size: 15px;
  line-height: 1.7;
}
a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 12px;
  font-size: 13px;
}
.section-copy > a {
  color: var(--home-highlight);
}
a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 4px;
}
img {
  display: block;
  width: 100%;
  height: auto;
}
.palette {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 24px;
}
.palette > .section-copy {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  padding: 48px 0 28px 48px;
}
.palette :deep(.shortcut-stage) {
  margin-top: auto;
  background: rgb(0 0 0 / 16%);
  border-color: rgb(255 255 255 / 8%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 3%);
}
.palette > .section-copy > a {
  margin-bottom: 28px;
}
.palette-image {
  display: grid;
  align-self: stretch;
  align-items: end;
  margin: 40px 0 0;
  min-width: 0;
}
.palette-image img {
  width: 840px;
  max-width: none;
}
@media (max-width: 760px) {
  .palette {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .palette > .section-copy {
    padding: 28px 24px 0;
  }
  .palette-image {
    margin: 0 12px -12px;
    height: auto;
    overflow: hidden;
    align-items: start;
  }
  .palette-image img {
    width: 100%;
    max-width: 100%;
  }
}

.palette-image img {
  grid-area: 1 / 1;
  visibility: hidden;
}
.palette-image img.is-active {
  visibility: visible;
}
</style>
