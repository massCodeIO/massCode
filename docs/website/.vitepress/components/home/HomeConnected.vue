<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeShortcuts from './HomeShortcuts.vue'
</script>

<template>
  <div class="connected-features">
    <section
      class="connections"
      aria-labelledby="connected-title"
    >
      <div class="section-copy">
        <h2 id="connected-title">
          Connected by context.
        </h2>
        <p>
          Link a technical note to the snippet that implements it and the
          request that tests it. Follow the whole idea without leaving your
          workspace.
        </p>
        <a :href="withBase('/documentation/notes/internal-links')">Explore internal links <ArrowRight
          :size="16"
          aria-hidden="true"
        /></a>
      </div>
      <div class="connection-image">
        <img
          :src="withBase('/notes-internal-links.png')"
          alt="Internal links in massCode Notes connect related work"
          loading="lazy"
          width="1280"
          height="880"
        >
      </div>
    </section>

    <section
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
        <HomeShortcuts />
      </div>
      <div class="palette-image">
        <img
          :src="withBase('/command-palette.png')"
          alt="massCode Command Palette with searchable content and actions"
          loading="lazy"
          width="1280"
          height="880"
        >
      </div>
    </section>

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
        <article class="utility">
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
          <div
            class="example diff-example"
            aria-label="Illustrative JSON change from staging to production"
          >
            <span class="example-label">JSON DIFF · EXAMPLE</span>
            <pre><code>{
<span class="removed">−  "environment": "staging",</span>
<span class="added">+  "environment": "production",</span>
   "retries": 3
}</code></pre>
          </div>
        </article>
        <article class="utility">
          <div class="utility-copy">
            <h3>Keep the calculation.</h3>
            <p>
              Use variables, convert units, and get results on every line. Keep
              the steps behind a number in your Math Notebook.
            </p>
            <a :href="withBase('/documentation/math/')">Explore Math Notebook <ArrowRight
              :size="16"
              aria-hidden="true"
            /></a>
          </div>
          <div
            class="example math-example"
            aria-label="Example calculation of monthly and yearly cost"
          >
            <span class="example-label">MATH NOTEBOOK · EXAMPLE</span>
            <div><code>servers = 4</code><span>4</span></div>
            <div><code>monthly = servers * 25</code><span>100</span></div>
            <div><code>monthly * 12</code><span>1,200</span></div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.connected-features {
  margin-top: 112px;
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
.connections .section-copy {
  max-width: 680px;
  margin: auto;
  text-align: center;
}
.connection-image {
  display: block;
  margin-top: 36px;
  height: 510px;
  overflow: hidden;
  border-radius: 20px;
  padding: 28px 64px 0;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
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
  gap: 56px;
  padding: 112px 0;
}
.palette-image {
  display: block;
  align-self: end;
  margin: 0;
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
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
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
.example {
  margin: auto 24px 24px;
  padding: 24px;
  border-radius: 12px;
  background: var(--vp-c-bg);
  min-height: 235px;
}
.example-label {
  display: block;
  margin-bottom: 24px;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--home-muted);
}
pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.85;
  overflow-x: auto;
}
.removed {
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
}
.added {
  background: var(--vp-c-tip-soft);
  color: var(--vp-c-tip-1);
}
.math-example > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  font-size: 13px;
}
.math-example > div + div {
  border-top: 1px solid var(--vp-c-divider);
}
.math-example > div > span {
  color: var(--home-highlight);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 760px) {
  .connected-features {
    margin-top: 64px;
  }
  .connection-image {
    padding: 14px 10px 0;
    height: 290px;
    border-radius: 12px;
  }
  .connection-image img {
    width: 540px;
    max-width: none;
  }
  .palette {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 64px 0;
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
  .example {
    margin: auto 12px 12px;
    padding: 20px 14px;
  }
  .math-example > div {
    font-size: 12px;
  }
}
</style>
