<script setup lang="ts">
import {
  ArrowRight,
  Calculator,
  CodeXml,
  FileText,
  Image,
  LayoutGrid,
  Send,
} from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { computed, ref } from 'vue'
import HomeCard from './HomeCard.vue'

const spaces = [
  {
    id: 'code',
    title: 'Code snippets',
    icon: CodeXml,
    image: '/home-code.png',
    description:
      'Organize snippets in folders, use tags, and keep useful code within reach.',
  },
  {
    id: 'notes',
    title: 'Notes',
    icon: FileText,
    image: '/notes.png',
    description:
      'Keep technical notes, project checklists, and ideas alongside your code.',
  },
  {
    id: 'http',
    title: 'HTTP client',
    icon: Send,
    image: '/http.png',
    description:
      'Organize requests, test your APIs, and inspect responses in one workspace.',
  },
  {
    id: 'drawings',
    title: 'Drawings',
    icon: Image,
    image: '/drawings.png',
    description:
      'Sketch diagrams and ideas on a canvas, then embed them in your notes.',
  },
]
const selected = ref(0)
const active = computed(() => spaces[selected.value])

function navigateTabs(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight')
    next = (index + 1) % spaces.length
  else if (event.key === 'ArrowLeft')
    next = (index + spaces.length - 1) % spaces.length
  else if (event.key === 'Home')
    next = 0
  else if (event.key === 'End')
    next = spaces.length - 1
  else return
  event.preventDefault()
  selected.value = next
  const list = (event.currentTarget as HTMLElement).parentElement
  list?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
</script>

<template>
  <section
    id="explore"
    class="showcase"
    aria-label="Explore massCode"
  >
    <div
      class="tabs"
      role="tablist"
      aria-label="Workspace previews"
    >
      <button
        v-for="(space, index) in spaces"
        :id="`tab-${space.id}`"
        :key="space.id"
        role="tab"
        :aria-selected="selected === index"
        :aria-controls="`panel-${space.id}`"
        :tabindex="selected === index ? 0 : -1"
        @click="selected = index"
        @keydown="navigateTabs($event, index)"
      >
        <span class="icon"><component
          :is="space.icon"
          :size="28"
          :stroke-width="1.6"
          aria-hidden="true"
        /></span>
        {{ space.title }}
      </button>
    </div>
    <HomeCard
      v-for="(space, index) in spaces"
      v-show="selected === index"
      :id="`panel-${space.id}`"
      :key="space.id"
      glow="center"
      fade-bottom
      class="preview"
      role="tabpanel"
      :aria-labelledby="`tab-${space.id}`"
      tabindex="0"
    >
      <div class="screenshot-link">
        <img
          :src="withBase(space.image)"
          :alt="`massCode ${space.title} workspace`"
          width="1280"
          height="880"
          :loading="index === 0 ? 'eager' : 'lazy'"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
        >
      </div>
    </HomeCard>
    <p
      class="caption"
      aria-live="polite"
    >
      {{ active.description }}
    </p>
    <a
      class="explore-link"
      :href="withBase(`/documentation/${active.id}/`)"
    >Explore {{ active.title }} <ArrowRight
      :size="16"
      aria-hidden="true"
    /></a>
    <div class="more">
      <span>Also built in</span>
      <a :href="withBase('/documentation/math/')"><Calculator
        :size="18"
        aria-hidden="true"
      /> Math notebook</a>
      <a :href="withBase('/documentation/tools/')"><LayoutGrid
        :size="18"
        aria-hidden="true"
      /> Developer tools</a>
    </div>
  </section>
</template>

<style scoped>
.showcase {
  padding-bottom: 0;
  text-align: center;
  scroll-margin-top: 88px;
}
.tabs {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 auto 24px;
}
.tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 8px;
  color: var(--home-muted);
  font-size: 14px;
  cursor: pointer;
  transition:
    color 160ms,
    background-color 160ms;
}
.icon {
  display: inline-flex;
  align-items: center;
}
.icon :deep(svg) {
  width: 20px;
  height: 20px;
}
.tabs button[aria-selected="true"] {
  box-shadow:
    inset 0 0 0 1px var(--vp-c-divider),
    0 3px 8px #00000008;
  background: var(--vp-c-bg-soft);
  color: var(--home-text);
}
.tabs button:hover {
  color: var(--home-text);
  background: var(--vp-c-bg-soft);
}
.preview {
  width: 100%;
  height: 580px;
  padding: 36px 48px 0;
  margin: 0 auto;
}
.screenshot-link {
  display: block;
  border-radius: 12px;
}
.preview img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1280 / 880;
  object-fit: contain;
  filter: drop-shadow(0 18px 20px rgb(0 0 0 / 40%));
}
.caption {
  max-width: 680px;
  margin: 16px auto 0;
  color: var(--home-text);
  font-size: 16px;
  line-height: 1.6;
  text-wrap: balance;
}
.explore-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  gap: 8px;
  color: var(--home-highlight);
  font-size: 14px;
}
.explore-link:hover,
.more a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.more {
  padding: 18px 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 24px;
  font-size: 14px;
  color: var(--home-muted);
}
.more a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  gap: 8px;
  color: var(--home-text);
}
button:focus-visible,
a:focus-visible,
.preview:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 4px;
}
@media (max-width: 640px) {
  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .tabs button {
    font-size: 13px;
    padding: 10px 8px;
  }
  .preview {
    width: 100%;
    height: 270px;
    padding: 18px 10px 0;
    border-radius: 12px;
  }
  .preview img {
    width: 530px;
    max-width: none;
  }
  .caption {
    min-height: 48px;
    font-size: 14px;
  }
  .more {
    gap: 0 20px;
  }
  .more > span {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tabs button {
    transition: none;
  }
}
</style>
