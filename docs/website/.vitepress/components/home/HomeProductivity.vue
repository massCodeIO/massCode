<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { ref } from 'vue'
import HomeCard from './HomeCard.vue'
import HomeShortcutDemo from './HomeShortcutDemo.vue'

const palettePhase = ref<'search' | 'commands'>('search')
</script>

<template>
  <div class="connected-features">
    <HomeCard
      as="section"
      glow="right"
      class="palette"
      aria-labelledby="palette-title"
    >
      <div class="section-copy">
        <h2 id="palette-title">
          A few keystrokes away.
        </h2>
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

    <section
      class="utilities"
      aria-labelledby="utilities-title"
    >
      <header class="section-copy">
        <h2 id="utilities-title">
          The little tools<br>you reach for.
        </h2>
        <p>
          Compare a response. Convert a value. Work out a number.<br
            class="wide-break"
          >
          Keep the small tasks in the same workspace.
        </p>
      </header>
      <div class="utility-grid">
        <HomeCard
          as="article"
          class="utility"
          glow="center"
        >
          <div class="utility-copy">
            <h3>Spot the difference.</h3>
            <p>
              Compare JSON side by side and inspect nested changes. Then reach
              for encoders, converters, and generators when you need them.
            </p>
            <a :href="withBase('/documentation/tools/')">Explore developer tools
              <ArrowRight
                :size="16"
                aria-hidden="true"
              /></a>
          </div>
          <div class="utility-image">
            <img
              :src="withBase('/home-json-diff.png')"
              alt="JSON Diff comparing original and modified JSON side by side"
              loading="lazy"
              width="1101"
              height="699"
            >
          </div>
        </HomeCard>
        <HomeCard
          as="article"
          class="utility"
          glow="center"
        >
          <div class="utility-copy">
            <h3>Keep the calculation.</h3>
            <p>
              Use variables, convert units and currencies, and see results as
              you type. Keep the steps behind a number in your Math Notebook.
            </p>
            <a :href="withBase('/documentation/math/')">Explore Math Notebook <ArrowRight
              :size="16"
              aria-hidden="true"
            /></a>
          </div>
          <div class="utility-image">
            <img
              :src="withBase('/home-math-notebook.png')"
              alt="Math Notebook with variables, percentages, currency and unit conversions"
              loading="lazy"
              width="1101"
              height="699"
            >
          </div>
        </HomeCard>
      </div>
    </section>
  </div>
</template>

<style scoped>
.connected-features {
  margin-top: 24px;
}
h2 {
  font-size: clamp(36px, 4.5vw, 58px);
  font-weight: 550;
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
p {
  margin-top: 22px;
  color: var(--home-muted);
  font-size: 17px;
  line-height: 1.7;
}
a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 14px;
  font-size: 14px;
}
.section-copy > a,
.utility-copy a {
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
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 24px;
  margin-bottom: 112px;
}
.palette > .section-copy {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  padding: 48px 0 28px 48px;
}
.palette h2 {
  font-size: clamp(34px, 3.8vw, 48px);
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
.utilities header {
  text-align: center;
  margin-bottom: 40px;
}
.utility-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}
.utility {
  display: flex;
  flex-direction: column;
}
.utility-copy {
  padding: 36px 36px 24px;
}
h3 {
  font-size: 30px;
  font-weight: 550;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.utility p {
  font-size: 15px;
  margin-top: 16px;
}
.utility-image {
  margin: auto 12px -28px;
}
.utility-image img {
  width: 100%;
  height: auto;
}
@media (max-width: 760px) {
  .connected-features {
    margin-top: 18px;
  }
  .palette {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 64px;
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
  .utility-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .utility-copy {
    padding: 28px 24px 20px;
  }
  .wide-break {
    display: none;
  }
  p {
    font-size: 16px;
  }
  h3 {
    font-size: 28px;
  }
  .utility-image {
    margin-inline: 0;
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
