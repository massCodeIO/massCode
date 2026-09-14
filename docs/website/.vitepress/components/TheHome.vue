<script setup lang="ts">
import {
  ArrowDown,
  ArrowRight,
  Check,
  Cloud,
  Copy,
  Download,
  FileText,
  Folder,
  GitBranch,
  RefreshCw,
  Terminal,
} from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { ref } from 'vue'
import HomeCard from './home/HomeCard.vue'
import HomeProductivity from './home/HomeProductivity.vue'
import HomeShowcase from './home/HomeShowcase.vue'
import HomeSponsors from './home/HomeSponsors.vue'
import HomeWorkflows from './home/HomeWorkflows.vue'

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
  <div class="masscode-home">
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
        Code, notes, APIs, diagrams, and calculations.<br
          class="desktop-break"
        >
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
    <HomeShowcase />
    <HomeWorkflows />
    <HomeProductivity />
    <section
      class="local-section"
      aria-labelledby="local-title"
    >
      <header class="local-heading">
        <h2 id="local-title">
          Your work. On your machine.
        </h2>
        <p>
          Keep your whole workspace close. Local files, open formats, and
          control over how your work moves between devices.
        </p>
      </header>
      <HomeCard
        glow="center"
        class="local"
      >
        <div class="details">
          <div>
            <div
              class="vault-visual"
              aria-label="Vault folders: code, notes, http, math. HTTP requests are Markdown files inside collections."
            >
              <div class="vault-root">
                <Folder
                  :size="22"
                  aria-hidden="true"
                /> My workspace
                <span>vault</span>
              </div>
              <div class="vault-files">
                <div>
                  <Folder
                    :size="17"
                    aria-hidden="true"
                  /><span>code</span>
                </div>
                <div>
                  <Folder
                    :size="17"
                    aria-hidden="true"
                  /><span>notes</span>
                </div>
                <div>
                  <Folder
                    :size="17"
                    aria-hidden="true"
                  /><span>http</span>
                </div>
                <div class="vault-nested">
                  <Folder
                    :size="17"
                    aria-hidden="true"
                  /><span>Northstar Commerce</span>
                </div>
                <div class="vault-file">
                  <FileText
                    :size="17"
                    aria-hidden="true"
                  /><span>Read an echo<span class="extension">.md</span></span>
                </div>
                <div>
                  <Folder
                    :size="17"
                    aria-hidden="true"
                  /><span>math</span>
                </div>
              </div>
            </div>
            <h3>Plain files. Yours to keep.</h3>
            <p>
              Code, notes, and requests in Markdown. Drawings in Excalidraw.
              Open your files outside massCode, too.
            </p>
            <a :href="withBase('/documentation/storage')">How storage works <ArrowRight
              :size="16"
              aria-hidden="true"
            /></a>
          </div>
          <div>
            <div
              class="sync-visual"
              aria-label="Sync your local vault using iCloud, Dropbox, Syncthing, or Git"
            >
              <div class="sync-source">
                <Folder
                  :size="26"
                  aria-hidden="true"
                /><span>My workspace</span>
              </div>
              <div class="sync-connector">
                <RefreshCw
                  :size="18"
                  aria-hidden="true"
                />
              </div>
              <div class="sync-options">
                <span><Cloud
                  :size="17"
                  aria-hidden="true"
                />iCloud</span>
                <span><Cloud
                  :size="17"
                  aria-hidden="true"
                />Dropbox</span>
                <span><RefreshCw
                  :size="17"
                  aria-hidden="true"
                />Syncthing</span>
                <span><GitBranch
                  :size="17"
                  aria-hidden="true"
                />Git</span>
              </div>
            </div>
            <h3>Your sync. Your choice.</h3>
            <p>
              Keep your vault on one computer, or sync its folder using iCloud,
              Dropbox, Syncthing, or Git.
            </p>
            <a :href="withBase('/documentation/sync')">Explore sync options <ArrowRight
              :size="16"
              aria-hidden="true"
            /></a>
          </div>
        </div>
      </HomeCard>
    </section>
    <section
      class="closing-cta"
      aria-labelledby="closing-title"
    >
      <h2 id="closing-title">
        Make room for your next idea.
      </h2>
      <p>
        Keep the code, context, and tools you need in one place. Free, open
        source, and ready to work offline.
      </p>
      <a
        class="download"
        :href="withBase('/download/')"
      ><Download
        :size="20"
        aria-hidden="true"
      /> Download Free</a>
      <p class="import-note">
        Bringing snippets, notes, or API collections from another app?
        <a :href="withBase('/documentation/imports')">Explore import options <ArrowRight
          :size="16"
          aria-hidden="true"
        /></a>
      </p>
    </section>
    <HomeSponsors />
  </div>
</template>

<style scoped>
.masscode-home {
  --home-highlight: var(--vp-c-brand-1);
  --home-text: var(--vp-c-text-1);
  --home-muted: var(--vp-c-text-2);
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px 64px;
  color: var(--home-text);
}
.masscode-home ::selection {
  background: var(--vp-c-brand-soft);
  color: var(--home-text);
}
.hero {
  padding: 106px 0 58px;
  text-align: center;
}
h1 {
  max-width: 1080px;
  margin: 0 auto;
  font-size: clamp(56px, 7.8vw, 100px);
  font-weight: 600;
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
.local-section {
  margin-top: 120px;
}
.local-heading {
  text-align: center;
  margin-bottom: 40px;
}
.local-heading h2 {
  font-size: clamp(36px, 4.5vw, 58px);
  line-height: 1.08;
}
.local {
  padding: 48px;
  text-align: center;
}
h2 {
  font-size: clamp(30px, 3.8vw, 44px);
  line-height: 1.2;
  font-weight: 550;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
.local-heading > p {
  max-width: 660px;
  margin-inline: auto;
  color: var(--home-muted);
  font-size: 18px;
  line-height: 1.65;
  margin-top: 18px;
}
.details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  max-width: 920px;
  margin: 0 auto;
  text-align: left;
}
h3 {
  font-size: 19px;
  font-weight: 550;
  margin-bottom: 12px;
}
.details > div {
  display: flex;
  flex-direction: column;
}
.details p {
  color: var(--home-muted);
  font-size: 16px;
  line-height: 1.7;
}
.details a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--home-highlight);
  margin-top: auto;
  padding-top: 12px;
  font-size: 14px;
}
.details a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
/* Illustrative local files and user-controlled sync paths. */
.vault-visual,
.sync-visual {
  height: 260px;
  margin-bottom: 24px;
}
.vault-visual,
.sync-visual {
  padding: 22px 24px;
  background: rgb(0 0 0 / 16%);
  border-radius: 14px;
  box-shadow: 0 12px 24px rgb(0 0 0 / 12%);
}
.vault-root {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}
.vault-root > svg,
.sync-source > svg {
  color: var(--home-highlight);
}
.vault-root > span {
  margin-left: auto;
  color: var(--home-muted);
  font-size: 11px;
}
.vault-files {
  margin: 16px 0 0 10px;
  padding-left: 20px;
  border-left: 1px solid var(--vp-c-divider);
}
.vault-files > div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 13px;
  white-space: nowrap;
}
.vault-files > .vault-nested {
  padding-left: 18px;
}
.vault-files > .vault-file {
  padding-left: 36px;
}
.vault-files svg,
.extension {
  color: var(--home-muted);
}
.sync-visual {
  display: flex;
  align-items: center;
}
.sync-source {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  flex-shrink: 0;
}
.sync-connector {
  display: flex;
  align-items: center;
  flex: 1;
  margin: 0 16px;
  color: var(--home-muted);
  gap: 8px;
}
.sync-connector::before,
.sync-connector::after {
  content: "";
  height: 1px;
  flex: 1;
  background: var(--vp-c-divider);
}
.sync-options {
  display: grid;
  gap: 10px;
  min-width: 130px;
}
.sync-options > span {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 8px 12px;
  background: rgb(0 0 0 / 16%);
  border-radius: 8px;
}
.sync-options svg {
  color: var(--home-muted);
}
@media (min-width: 641px) and (max-width: 1000px) {
  .details {
    gap: 28px;
  }
  .vault-visual,
  .sync-visual {
    padding-inline: 12px;
  }
  .vault-files {
    padding-left: 10px;
  }
  .vault-files > div {
    font-size: 11px;
  }
  .sync-connector {
    margin-inline: 8px;
  }
}
@media (max-width: 640px) {
  .vault-visual,
  .sync-visual {
    padding-inline: 14px;
  }
  .vault-files {
    padding-left: 12px;
  }
  .vault-files > div {
    font-size: 11px;
  }
}
.closing-cta {
  padding: 104px 24px 32px;
  text-align: center;
}
.closing-cta h2 {
  font-size: clamp(36px, 4.8vw, 60px);
}
.closing-cta > p:not(.import-note) {
  max-width: 530px;
  margin: 20px auto 28px;
  color: var(--home-muted);
  font-size: 18px;
  line-height: 1.65;
}
.closing-cta .import-note {
  flex-direction: column;
  margin-top: 28px;
  font-size: 13px;
}
@media (max-width: 640px) {
  .closing-cta {
    padding: 64px 0 16px;
  }
}
.import-note {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0 6px;
  margin-top: 24px;
  color: var(--home-muted);
  font-size: 14px;
}
.import-note a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--home-highlight);
}
.import-note a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.masscode-home :deep(svg) {
  fill: none !important;
  flex-shrink: 0;
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 5px;
}
@media (max-width: 640px) {
  .masscode-home {
    padding: 0 20px 40px;
  }
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
  .local-section {
    margin-top: 64px;
  }
  .local {
    padding: 36px 24px;
  }
  .local-heading > p {
    font-size: 17px;
  }
  .details {
    grid-template-columns: 1fr;
    gap: 32px;
    margin: 36px 0;
  }
}
</style>
