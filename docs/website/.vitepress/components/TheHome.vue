<script setup lang="ts">
import { ArrowDown, ArrowRight, Download } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeConnected from './home/HomeConnected.vue'
import HomeShowcase from './home/HomeShowcase.vue'
import HomeWorkflows from './home/HomeWorkflows.vue'
import SponsorsGroup from './sponsors/SponsorsGroup.vue'
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
    </section>
    <HomeShowcase />
    <HomeWorkflows />
    <HomeConnected />
    <section
      class="local"
      aria-labelledby="local-title"
    >
      <h2 id="local-title">
        Your work. On your machine.
      </h2>
      <p>
        Your workspace lives on your computer. Keep your code, notes, API
        collections, drawings, and calculations close—with control over your
        data.
      </p>
      <div class="details">
        <div>
          <h3>Plain files. Yours to keep.</h3>
          <p>
            Your vault holds code, notes, and API requests as Markdown, and
            drawings as Excalidraw files. Your work stays accessible outside
            massCode.
          </p>
          <a :href="withBase('/documentation/storage')">How storage works <ArrowRight
            :size="16"
            aria-hidden="true"
          /></a>
        </div>
        <div>
          <h3>Your sync. Your choice.</h3>
          <p>
            Keep your vault on one computer, or sync it with iCloud, Dropbox,
            Syncthing, or Git.
          </p>
          <a :href="withBase('/documentation/sync')">Explore sync options <ArrowRight
            :size="16"
            aria-hidden="true"
          /></a>
        </div>
      </div>
      <a
        class="download"
        :href="withBase('/download/')"
      ><Download
        :size="20"
        aria-hidden="true"
      /> Download Free</a>
    </section>
    <p class="import-note">
      Already have a library?
      <a :href="withBase('/documentation/imports')">See supported imports
        <ArrowRight
          :size="16"
          aria-hidden="true"
        />
      </a>
    </p>
    <SponsorsGroup
      title="Special"
      tier="special"
    />
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
.local {
  margin-top: 120px;
  padding: 72px 48px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  background: var(--vp-c-bg-soft);
  text-align: center;
}
h2 {
  font-size: clamp(30px, 3.8vw, 44px);
  line-height: 1.2;
  font-weight: 550;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
.local > p {
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
  gap: 72px;
  max-width: 920px;
  margin: 56px auto 48px;
  text-align: left;
}
h3 {
  font-size: 19px;
  font-weight: 550;
  margin-bottom: 12px;
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
  margin-top: 12px;
  font-size: 14px;
}
.details a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
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
  .local {
    margin-top: 64px;
    padding: 36px 24px;
  }
  .local > p {
    font-size: 17px;
  }
  .details {
    grid-template-columns: 1fr;
    gap: 32px;
    margin: 36px 0;
  }
}
</style>
