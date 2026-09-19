<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeCard from './HomeCard.vue'
</script>

<template>
  <section
    class="utilities"
    aria-labelledby="utilities-title"
  >
    <header class="section-copy">
      <h2 id="utilities-title">
        The little tools you reach for.
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
            Compare JSON side by side and inspect nested changes. Then reach for
            encoders, converters, and generators when you need them.
          </p>
          <a :href="withBase('/documentation/tools/')">Explore developer tools <ArrowRight
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
            Use variables, convert units and currencies, and see results as you
            type. Keep the steps behind a number in your Math Notebook.
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
</template>

<style scoped>
h2 {
  font-size: clamp(36px, 4.5vw, 58px);
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
.utilities {
  margin-top: 112px;
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
  .utilities {
    margin-top: 64px;
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
</style>
