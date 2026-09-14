<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeCard from './HomeCard.vue'

// Existing documentation captures are temporary artwork. Replace each with
// a scenario-specific light/dark capture when the final screenshots are ready.
const workflows = [
  {
    id: 'code',
    title: 'Keep the code you’ll need again.',
    description:
      'Useful commands, tried-and-tested functions, and configuration examples. Build a searchable library you can reach for in your next project.',
    detail: 'Folders, tags, and fragments keep related code together.',
    image: '/home-code-2.png',
    link: 'Explore code snippets',
  },
  {
    id: 'notes',
    title: 'Keep the thinking behind it.',
    description:
      'A snippet is more useful with its context. Write technical notes in Markdown and connect them to the code and requests they explain.',
    detail: 'Bring ideas to life with diagrams, checklists, and linked notes.',
    image: '/notes.png',
    link: 'Explore notes',
  },
  {
    id: 'http',
    title: 'Put your APIs to the test.',
    description:
      'Build requests, switch environments, and inspect responses. Keep your API collections alongside the code and notes you work with.',
    detail: 'HTTP, GraphQL, and WebSocket, all in one workspace.',
    image: '/http.png',
    link: 'Explore the HTTP client',
  },
]
</script>

<template>
  <section
    class="workflows"
    aria-label="Everyday work with massCode"
  >
    <header class="section-heading">
      <p>LESS SCATTERED. MORE CONNECTED.</p>
      <h2>A home for the work<br>around your code.</h2>
    </header>
    <HomeCard
      v-for="workflow in workflows"
      :key="workflow.id"
      as="article"
      :glow="workflow.id === 'notes' ? 'left' : 'right'"
      class="workflow"
      :class="[`workflow-${workflow.id}`]"
    >
      <div class="workflow-copy">
        <span class="section-label">{{
          workflow.id === "code"
            ? "CODE SNIPPETS"
            : workflow.id === "notes"
              ? "MARKDOWN NOTES"
              : "API WORKSPACE"
        }}</span>
        <h2>{{ workflow.title }}</h2>
        <p>{{ workflow.description }}</p>
        <p class="detail">
          {{ workflow.detail }}
        </p>
        <a :href="withBase(`/documentation/${workflow.id}/`)">
          {{ workflow.link }} <ArrowRight
            :size="16"
            aria-hidden="true"
          />
        </a>
      </div>
      <div class="workflow-visual">
        <img
          :src="withBase(workflow.image)"
          :alt="`massCode ${workflow.id} workspace`"
          width="1280"
          height="880"
          loading="lazy"
        >
      </div>
    </HomeCard>
  </section>
</template>

<style scoped>
.workflows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 112px;
}
.section-heading {
  grid-column: 1 / -1;
  text-align: center;
  margin-bottom: 32px;
}
.section-heading > p,
.section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--home-muted);
}
.section-heading h2 {
  margin-top: 20px;
  font-size: clamp(36px, 4.5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.045em;
}
.workflow-copy {
  padding: 36px 36px 24px;
}
h2 {
  margin-top: 14px;
  font-size: clamp(28px, 3vw, 38px);
  font-weight: 550;
  line-height: 1.12;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
p {
  margin-top: 18px;
  color: var(--home-muted);
  font-size: 15px;
  line-height: 1.7;
}
p.detail {
  display: none;
}
.workflow-copy a {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--home-text);
}
.workflow-copy a:hover {
  color: var(--home-highlight);
}
.workflow-visual {
  display: block;
  height: 320px;
  margin: 0 0 0 24px;
}
img {
  width: 700px;
  max-width: none;
  height: auto;
  display: block;
  transition: transform 250ms;
}
.workflow-code {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  align-items: center;
  min-height: 450px;
}
.workflow-code .workflow-copy {
  padding: 48px;
}
.workflow-code h2 {
  font-size: clamp(34px, 3.8vw, 48px);
}
.workflow-code .workflow-visual {
  height: 400px;
  margin: 40px 0 0;
}
.workflow-code img {
  width: 840px;
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: -4px;
}
@media (max-width: 760px) {
  .workflows {
    grid-template-columns: 1fr;
    margin-top: 64px;
    gap: 18px;
  }
  .section-heading {
    margin-bottom: 16px;
  }
  .workflow-code {
    display: block;
    min-height: 0;
  }
  .workflow-copy,
  .workflow-code .workflow-copy {
    padding: 28px 24px 16px;
  }
  .workflow-visual,
  .workflow-code .workflow-visual {
    height: 260px;
    margin: 10px 0 0 12px;
  }
  .workflow img {
    width: 550px;
  }
}
@media (prefers-reduced-motion: reduce) {
  img {
    transition: none;
  }
}
</style>
