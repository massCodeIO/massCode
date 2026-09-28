<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import sponsorsData from './sponsors.json'

interface Sponsor {
  url: string
  img: string
  name: string
  text?: string
}

interface SponsorData {
  special: Sponsor[]
}

interface Props {
  title?: string
  tier: keyof SponsorData
  placement?: 'home' | 'sidebar'
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'home',
})

const sponsorUrl
  = 'https://opencollective.com/masscode/contribute/silver-sponsors-43169/checkout?interval=month&amount=50&contributeAs=me'

const ctaSparks = [
  {
    tx: '-22px',
    ty: '-26px',
    rot: '-32deg',
    delay: '0s',
    duration: '2.4s',
    size: '11px',
  },
  {
    tx: '24px',
    ty: '-28px',
    rot: '34deg',
    delay: '0.55s',
    duration: '2.6s',
    size: '13px',
  },
  {
    tx: '-28px',
    ty: '-6px',
    rot: '-52deg',
    delay: '1.05s',
    duration: '2.0s',
    size: '9px',
  },
  {
    tx: '26px',
    ty: '-4px',
    rot: '46deg',
    delay: '0.3s',
    duration: '2.2s',
    size: '10px',
  },
  {
    tx: '-8px',
    ty: '-30px',
    rot: '-10deg',
    delay: '0.85s',
    duration: '2.5s',
    size: '12px',
  },
  {
    tx: '10px',
    ty: '-32px',
    rot: '14deg',
    delay: '1.45s',
    duration: '2.3s',
    size: '10px',
  },
] as const

const data = ref<SponsorData>(sponsorsData)
const isShow = ref(false)

const sponsorsRef = ref<HTMLElement>()

function showSponsors() {
  if (props.placement === 'sidebar')
    return

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        isShow.value = true
        observer.disconnect()
      }
    },
    { rootMargin: '0px 0px 300px 0px' },
  )
  observer.observe(sponsorsRef.value)

  onUnmounted(() => observer.disconnect())
}

onMounted(async () => {
  showSponsors()
})
</script>

<template>
  <div
    ref="sponsorsRef"
    class="sponsors"
    :class="{ sidebar: placement === 'sidebar' }"
  >
    <template v-if="placement === 'sidebar' || isShow">
      <h2>{{ title }} sponsors</h2>
      <div class="body">
        <a
          v-for="{ img, url, name, text } of data[tier]"
          :key="name"
          :href="url"
          target="_blank"
          class="sponsors-item"
          rel="noopener sponsored"
        >
          <img
            :src="img"
            :alt="name"
          >
          <div
            v-if="placement === 'sidebar' && text"
            class="text"
          >
            {{ text }}
          </div>
        </a>
        <a
          v-if="placement === 'home'"
          :href="sponsorUrl"
          class="sponsors-item sponsors-item-cta"
          target="_blank"
          rel="noopener"
        >
          <span class="cta-heart-wrap">
            <svg
              class="cta-heart"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                fill="transparent"
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              />
            </svg>
            <span
              class="cta-spark-layer"
              aria-hidden="true"
            >
              <span
                v-for="(spark, i) in ctaSparks"
                :key="i"
                class="cta-spark"
                :style="{
                  '--tx': spark.tx,
                  '--ty': spark.ty,
                  '--rot': spark.rot,
                  '--delay': spark.delay,
                  '--duration': spark.duration,
                  '--size': spark.size,
                }"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 21s-7-4.5-9.5-9C-0.5 6.5 5 1.5 12 6c7-4.5 12.5 0.5 9.5 6-2.5 4.5-9.5 9-9.5 9z"
                  />
                </svg>
              </span>
            </span>
          </span>
          <span class="cta-title">Become a sponsor</span>
          <span class="cta-subtitle">Your logo here</span>
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sponsors {
  margin-top: 48px;

  .body {
    margin-top: 24px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;

    img {
      max-height: 40px;
    }
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
  }

  &.sidebar {
    margin-top: 0;

    h2 {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vp-c-text-3);
    }

    .body {
      margin-top: 8px;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .sponsors-item {
      padding: 12px 24px;
    }

    .text {
      font-size: 12px;
      color: var(--vp-c-text-2);
      line-height: 12px;
      margin-top: 8px;
    }
  }
}

.sponsors-item {
  background-color: var(--vp-c-bg-soft);
  padding: 24px;
  border-radius: 4px;
  display: flex;
  flex-flow: column;
  align-items: center;
  justify-content: center;
}

@property --sponsor-cta-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.sponsors-item-cta {
  /* Multiplier for the heart spray reach. 1 = default, 1.5 = 50% wider, 0.5 = half. */
  --spray-scale: 2;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  gap: 6px;
  text-align: center;
  text-decoration: none;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)) padding-box,
    conic-gradient(
        from var(--sponsor-cta-angle),
        color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent),
        color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent) 60deg,
        var(--vp-c-brand-1) 110deg,
        color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent) 160deg,
        color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent) 360deg
      )
      border-box;
  animation: sponsor-cta-shimmer 6s linear infinite;
  transition: transform 0.35s ease;
}

.dark .sponsors-item-cta {
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)) padding-box,
    conic-gradient(
        from var(--sponsor-cta-angle),
        color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent),
        color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent) 60deg,
        var(--vp-c-brand-1) 110deg,
        color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent) 160deg,
        color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent) 360deg
      )
      border-box;
}

@keyframes sponsor-cta-shimmer {
  to {
    --sponsor-cta-angle: 360deg;
  }
}

/* .sponsors-item-cta:hover {
  transform: translateY(-2px);
} */

.sponsors-item-cta:hover .cta-heart {
  color: var(--vp-c-brand-1);
  transform: scale(1.08);
}

.sponsors-item-cta:hover .cta-heart path {
  fill: color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .sponsors-item-cta {
    animation: none;
  }
}

.cta-heart-wrap {
  position: relative;
  display: block;
  width: 26px;
  height: 26px;
  margin-bottom: 4px;
}

.cta-heart {
  display: block;
  width: 100%;
  height: 100%;
  color: color-mix(in srgb, var(--vp-c-brand-1) 78%, transparent);
  transition:
    color 0.35s ease,
    transform 0.35s ease;
}

.cta-heart path {
  transition: fill 0.35s ease;
}

/* Override global `.dark svg { fill: ... !important }` for the outline heart. */
.dark .sponsors-item-cta .cta-heart {
  fill: none !important;
}

.cta-spark-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.sponsors-item-cta:hover .cta-spark-layer {
  opacity: 1;
}

.cta-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--size);
  height: var(--size);
  margin-left: calc(var(--size) / -2);
  margin-top: calc(var(--size) / -2);
  color: var(--vp-c-brand-1);
  opacity: 0;
  filter: drop-shadow(
    0 0 4px color-mix(in srgb, var(--vp-c-brand-1) 45%, transparent)
  );
  animation: cta-spark-emit var(--duration) ease-out infinite;
  animation-delay: var(--delay);
  animation-play-state: paused;
}

.sponsors-item-cta:hover .cta-spark {
  animation-play-state: running;
}

.cta-spark svg {
  display: block;
  width: 100%;
  height: 100%;
}

@keyframes cta-spark-emit {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.25) rotate(0deg);
  }
  18% {
    opacity: 0.9;
    transform: translate(
        calc(var(--tx) * 0.28 * var(--spray-scale)),
        calc(var(--ty) * 0.28 * var(--spray-scale))
      )
      scale(0.85) rotate(calc(var(--rot) * 0.3));
  }
  100% {
    opacity: 0;
    transform: translate(
        calc(var(--tx) * var(--spray-scale)),
        calc(var(--ty) * var(--spray-scale))
      )
      scale(0.55) rotate(var(--rot));
  }
}

@media (prefers-reduced-motion: reduce) {
  .cta-spark-layer {
    display: none;
  }
}

.cta-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}

.cta-subtitle {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.dark .sponsors-item img {
  transition: all 0.2s;
  filter: grayscale(1) invert(1);
}

.dark .sponsors-item:hover img {
  filter: none;
}

@media (max-width: 767px) {
  .sponsors:not(.sidebar) {
    .body {
      grid-template-columns: 1fr;
    }
  }
}
</style>
