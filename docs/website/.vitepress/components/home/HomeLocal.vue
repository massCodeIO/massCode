<script setup lang="ts">
import {
  ArrowRight,
  Cloud,
  FileText,
  Folder,
  GitBranch,
  RefreshCw,
} from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeCard from './HomeCard.vue'
</script>

<template>
  <section
    class="local-section"
    aria-labelledby="local-title"
  >
    <header class="local-heading">
      <h2 id="local-title">
        Your work. On your machine.
      </h2>
      <p>
        Keep your whole workspace close. Local files, open formats, and control
        over how your work moves between devices.
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
            Code, notes, and requests in Markdown. Drawings in Excalidraw. Open
            your files outside massCode, too.
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
            Dropbox, other cloud storage, Syncthing, or Git.
          </p>
          <a :href="withBase('/documentation/sync')">Explore sync options <ArrowRight
            :size="16"
            aria-hidden="true"
          /></a>
        </div>
      </div>
    </HomeCard>
  </section>
</template>

<style scoped>
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
  margin-bottom: 12px;
}
.details > div {
  min-width: 0;
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
@media (max-width: 640px) {
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
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
    margin: 0;
  }
}
@media (max-width: 760px) {
  .details {
    grid-template-columns: minmax(0, 1fr);
  }
  .local {
    padding: 24px 16px;
  }
  .vault-visual,
  .sync-visual {
    height: auto;
    min-height: 240px;
  }
  .vault-files > div {
    white-space: normal;
  }
  .vault-files > div > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .sync-visual {
    flex-direction: column;
    padding-block: 24px;
    gap: 16px;
  }
  .sync-connector {
    flex: none;
    width: 1px;
    height: 24px;
    margin: 0;
    background: var(--vp-c-divider);
  }
  .sync-connector svg {
    display: none;
  }
  .sync-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    min-width: 0;
    gap: 8px;
  }
  .sync-options > span {
    padding: 8px 6px;
    font-size: 11px;
    gap: 6px;
  }
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 5px;
}
</style>
