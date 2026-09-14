<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: 'div' | 'article' | 'section'
    glow?: 'left' | 'center' | 'right' | 'none'
    grain?: boolean
    fadeBottom?: boolean
  }>(),
  {
    as: 'div',
    glow: 'center',
    grain: true,
    fadeBottom: false,
  },
)
</script>

<template>
  <component
    :is="as"
    class="home-card"
    :class="{ 'has-grain': grain, 'has-fade': fadeBottom }"
    :data-glow="glow"
  >
    <span
      v-if="glow !== 'none'"
      class="card-rim"
      aria-hidden="true"
    />
    <slot />
  </component>
</template>

<style scoped>
/* Layout belongs to the caller; the card owns its material and edge treatment.
   --card-glow-strength and --card-fade-height can be overridden per instance. */
.home-card {
  --card-glow-x: 50%;
  --card-glow-strength: 9%;
  --card-fade-height: 80px;
  --card-rim-strength: 65%;
  position: relative;
  isolation: isolate;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background:
    radial-gradient(
      ellipse at var(--card-glow-x) 0%,
      rgb(255 255 255 / var(--card-glow-strength)),
      transparent 72%
    ),
    var(--vp-c-bg-soft);
  box-shadow:
    inset 0 1px 0 #ffffff18,
    0 20px 48px -24px #00000080;
}
.home-card[data-glow="left"] {
  --card-glow-x: 0%;
}
.home-card[data-glow="right"] {
  --card-glow-x: 100%;
}
.home-card[data-glow="none"] {
  --card-glow-strength: 0%;
}
.card-rim {
  position: absolute;
  inset: 0;
  z-index: 2;
  padding: 1px;
  border-radius: inherit;
  background: radial-gradient(
    ellipse 42% 100px at var(--card-glow-x) 0%,
    rgb(255 255 255 / var(--card-rim-strength)),
    rgb(255 255 255 / 18%) 38%,
    transparent 100%
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
.has-grain::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22180%22%20height%3D%22180%22%20viewBox%3D%220%200%20180%20180%22%3E%20%3Cfilter%20id%3D%22noise%22%20x%3D%220%22%20y%3D%220%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%20%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.85%22%20numOctaves%3D%223%22%20stitchTiles%3D%22stitch%22%2F%3E%20%3CfeColorMatrix%20type%3D%22saturate%22%20values%3D%220%22%2F%3E%20%3C%2Ffilter%3E%20%3Cpath%20fill%3D%22%23fff%22%20filter%3D%22url%28%23noise%29%22%20d%3D%22M0%200h180v180H0z%22%2F%3E%20%3C%2Fsvg%3E")
    repeat;
  filter: contrast(240%) brightness(105%);
  mix-blend-mode: soft-light;
  mask-image: linear-gradient(
    135deg,
    #000 0%,
    rgb(0 0 0 / 65%) 45%,
    transparent 90%
  );
  opacity: 0.22;
  pointer-events: none;
}
.has-fade::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: var(--card-fade-height);
  z-index: 1;
  background: linear-gradient(to bottom, transparent, var(--vp-c-bg-soft));
  pointer-events: none;
}
</style>
