<script setup lang="ts">
import { ArrowRight, Download } from 'lucide-vue-next'
import { withBase } from 'vitepress'
</script>

<template>
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
</template>

<style scoped>
h2 {
  font-size: clamp(30px, 3.8vw, 44px);
  line-height: 1.2;
  letter-spacing: -0.03em;
  text-wrap: balance;
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
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 5px;
}
</style>
