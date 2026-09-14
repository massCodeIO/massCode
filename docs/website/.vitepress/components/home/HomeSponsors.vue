<script setup lang="ts">
import { ArrowUpRight, Heart } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import sponsors from '../sponsors/sponsors.json'
</script>

<template>
  <section
    class="home-sponsors"
    aria-labelledby="sponsors-title"
  >
    <div class="sponsor-heading">
      <div>
        <h2 id="sponsors-title">
          Supported by great people.
        </h2>
        <p>Thank you to the special sponsors supporting massCode.</p>
      </div>
    </div>
    <div class="sponsor-logos">
      <a
        v-for="sponsor in sponsors.special"
        :key="sponsor.name"
        :href="sponsor.url"
        target="_blank"
        rel="noopener sponsored"
        :aria-label="`${sponsor.name} (opens in a new tab)`"
      >
        <img
          :src="
            sponsor.img.startsWith('/') ? withBase(sponsor.img) : sponsor.img
          "
          :alt="sponsor.name"
          loading="lazy"
        >
        <span v-if="sponsor.name === 'Timefall'">Timefall</span>
      </a>
      <a
        class="sponsor-cta"
        href="https://opencollective.com/masscode/contribute/silver-sponsors-43169/checkout?interval=month&amount=50&contributeAs=me"
        target="_blank"
        rel="noopener"
      ><Heart
        :size="17"
        aria-hidden="true"
      /> Become a sponsor
        <ArrowUpRight
          :size="16"
          aria-hidden="true"
        /></a>
    </div>
  </section>
</template>

<style scoped>
.home-sponsors {
  margin-top: 80px;
  padding: 56px 0 8px;
  border-top: 1px solid var(--vp-c-divider);
}
.sponsor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
}
h2 {
  font-size: clamp(26px, 3vw, 36px);
  font-weight: 550;
  letter-spacing: -0.03em;
  line-height: 1.2;
  text-wrap: balance;
}
p {
  margin-top: 12px;
  color: var(--home-muted);
  font-size: 15px;
  line-height: 1.6;
}
.sponsor-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  flex-shrink: 0;
  min-height: 44px;
  padding: 10px 16px;

  font-size: 13px;
}
.sponsor-cta:hover {
  background: var(--vp-c-bg-soft);
}
.sponsor-cta > svg:first-child {
  color: var(--home-highlight);
}
.sponsor-logos {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  padding: 1px;
  background: var(--vp-c-divider);
  margin-top: 36px;
}
.sponsor-logos a {
  min-height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: var(--vp-c-bg);
  min-width: 0;
}
.sponsor-logos a:hover {
  background: var(--vp-c-bg-soft);
}
img {
  max-width: min(190px, 100%);
  max-height: 40px;
  object-fit: contain;
}
.sponsor-logos span {
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.5px;
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: -3px;
}
@media (max-width: 960px) {
  .sponsor-logos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .home-sponsors {
    margin-top: 48px;
    padding-top: 36px;
  }
  .sponsor-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  .sponsor-logos {
    grid-template-columns: 1fr;
    margin-top: 24px;
  }
  .sponsor-logos a {
    min-height: 90px;
  }
}
</style>
