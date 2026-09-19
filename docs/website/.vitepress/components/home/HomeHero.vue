<script setup lang="ts">
import { ArrowDown, Check, Copy, Download, Terminal } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { ref } from 'vue'

const brewCommand = 'brew install --cask masscode'
const brewCopied = ref(false)
const brewError = ref(false)

async function copyBrewCommand() {
  try {
    await navigator.clipboard.writeText(brewCommand)
    brewCopied.value = true
    brewError.value = false
  }
  catch {
    brewError.value = true
  }
}
</script>

<template>
  <section
    class="hero"
    aria-labelledby="home-title"
  >
    <p class="eyebrow">
      FREE &amp; OPEN SOURCE · LOCAL-FIRST · WORKS OFFLINE
    </p>
    <h1 id="home-title">
      Your developer<br><span>workspace.</span>
    </h1>
    <p class="intro">
      Code, notes, APIs, diagrams, and calculations.<br class="desktop-break">
      Always within reach.
    </p>
    <div class="actions">
      <a
        class="download"
        :href="withBase('/download/')"
      ><Download
        :size="20"
        aria-hidden="true"
      /> Download Free</a>
      <a
        class="see-action"
        href="#explore"
      ><ArrowDown
        :size="24"
        aria-hidden="true"
      /> Explore workspaces</a>
    </div>
    <details class="homebrew">
      <summary>
        <Terminal
          :size="16"
          aria-hidden="true"
        /> Install via Homebrew
      </summary>
      <div class="brew-command">
        <code>{{ brewCommand }}</code>
        <button
          :aria-label="
            brewCopied ? 'Copy command again' : 'Copy Homebrew command'
          "
          @click="copyBrewCommand"
        >
          <Check
            v-if="brewCopied"
            :size="16"
            aria-hidden="true"
          />
          <Copy
            v-else
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
      <p
        class="brew-status"
        role="status"
      >
        {{
          brewError
            ? "Select and copy the command above."
            : brewCopied
              ? "Command copied."
              : ""
        }}
      </p>
    </details>
  </section>
</template>

<style scoped>
.hero {
  padding: 106px 0 58px;
  text-align: center;
}
h1 {
  max-width: 1080px;
  margin: 0 auto;
  font-size: clamp(56px, 7.8vw, 100px);
  line-height: 1.02;
  letter-spacing: -0.065em;
  text-wrap: balance;
}
.eyebrow {
  margin-bottom: 24px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--home-muted);
}
h1 span {
  color: var(--home-highlight);
}
.intro {
  max-width: 650px;
  margin: 24px auto 0;
  color: var(--home-muted);
  font-size: 19px;
  line-height: 1.6;
  text-wrap: balance;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  margin-top: 28px;
}
.download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  padding: 12px 20px;
  border: 1px solid color-mix(in srgb, var(--home-text) 80%, transparent);
  box-shadow:
    0 2px 3px #00000012,
    inset 0 1px 0 #ffffff30;
  border-radius: 10px;
  background: var(--home-text);
  color: var(--vp-c-bg);
  font-size: 15px;
  font-weight: 550;
  transition: opacity 160ms;
}
.download:hover {
  opacity: 0.82;
}
.see-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  color: var(--home-text);
  font-size: 15px;
}
.see-action:hover {
  text-decoration: underline;
  text-underline-offset: 5px;
}
.homebrew {
  width: fit-content;
  max-width: 100%;
  margin: 14px auto 0;
}
.homebrew summary {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 13px;
  color: var(--home-text);
  cursor: pointer;
  list-style: none;
}
.homebrew summary::-webkit-details-marker {
  display: none;
}
.homebrew summary > span {
  color: var(--home-muted);
  font-size: 11px;
}
.homebrew summary:hover {
  color: var(--home-highlight);
}
.brew-command {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 4px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.brew-command code {
  font-size: 13px;
  user-select: all;
}
.brew-command button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 40px;
  cursor: pointer;
}
.brew-status {
  min-height: 20px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--home-muted);
}
.homebrew summary:focus-visible,
.brew-command button:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 3px;
  border-radius: 4px;
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 5px;
}
@media (max-width: 640px) {
  .hero {
    padding: 78px 0 36px;
  }
  .eyebrow {
    font-size: 9px;
    letter-spacing: 0.11em;
    margin-bottom: 22px;
  }
  h1 {
    font-size: clamp(42px, 11.5vw, 64px);
    letter-spacing: -0.03em;
  }
  .intro {
    font-size: 17px;
    margin-top: 20px;
  }
  .desktop-break {
    display: none;
  }
  .actions {
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
  }
}
</style>
