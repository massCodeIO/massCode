<script setup lang="ts">
import HomeClosing from './home/HomeClosing.vue'
import HomeDeveloperTools from './home/HomeDeveloperTools.vue'
import HomeHero from './home/HomeHero.vue'
import HomeLocal from './home/HomeLocal.vue'
import HomeShowcase from './home/HomeShowcase.vue'
import HomeSponsors from './home/HomeSponsors.vue'
import HomeWorkflows from './home/HomeWorkflows.vue'
</script>

<template>
  <div class="masscode-home">
    <HomeHero />
    <HomeShowcase />
    <HomeWorkflows />
    <HomeDeveloperTools />
    <HomeLocal />
    <HomeClosing />
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
.masscode-home :deep(:is(h1, h2, h3, h4, h5, h6)) {
  font-weight: 600;
}
.masscode-home ::selection {
  background: var(--vp-c-brand-soft);
  color: var(--home-text);
}
.masscode-home :deep(svg) {
  fill: none !important;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  .masscode-home {
    padding: 0 20px 40px;
  }
}
</style>
