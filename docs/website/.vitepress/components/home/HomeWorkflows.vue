<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeCard from './HomeCard.vue'

const workflows = [
  {
    id: 'graph',
    label: 'CONNECTED KNOWLEDGE',
    title: 'See how your ideas connect.',
    description:
      'Explore the links between your notes in a graph. Connect technical notes to the snippets and API requests they explain, so the next step is always close.',
    image: '/home-notes-graph.png',
    width: 1520,
    height: 1054,
    alt: 'Notes Graph showing connections between linked notes',
    href: '/documentation/notes/',
    link: 'Explore Notes',
  },
  {
    id: 'tasks',
    label: 'TASK NOTES',
    title: 'Turn your notes into next steps.',
    description:
      'Track tasks with status, priority, and due dates. Link to planned notes, snippets, and API requests. Keep context close and find tasks by due date in Today and Upcoming.',
    image: '/home-notes-tasks.png',
    width: 1280,
    height: 880,
    alt: 'Task note with status, priority, and due date',
    href: '/documentation/notes/',
    link: 'Explore Notes',
  },
  {
    id: 'api-workflows',
    label: 'API WORKFLOWS',
    title: 'Test the whole flow.',
    description:
      'Run saved requests in sequence, pass values between steps, and inspect test results. Follow a workflow from login to its final response and see where it fails.',
    image: '/home-http-assertions.png',
    width: 1280,
    height: 880,
    alt: 'HTTP request with assertions and passing test results',
    href: '/documentation/http/',
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
      <h2>From saved knowledge<br>to working solutions.</h2>
    </header>
    <HomeCard
      v-for="workflow in workflows"
      :key="workflow.id"
      as="article"
      :glow="workflow.id === 'tasks' ? 'left' : 'right'"
      class="workflow"
      :class="[`workflow-${workflow.id}`]"
    >
      <div class="workflow-copy">
        <span class="section-label">{{ workflow.label }}</span>
        <h3>{{ workflow.title }}</h3>
        <p>{{ workflow.description }}</p>
        <a :href="withBase(workflow.href)">
          {{ workflow.link }} <ArrowRight
            :size="16"
            aria-hidden="true"
          />
        </a>
      </div>
      <div class="workflow-visual">
        <img
          :src="withBase(workflow.image)"
          :alt="workflow.alt"
          :width="workflow.width"
          :height="workflow.height"
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
h3 {
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
.workflow-graph {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  align-items: center;
  min-height: 450px;
}
.workflow-graph .workflow-copy {
  padding: 48px;
}
.workflow-graph h3 {
  font-size: clamp(34px, 3.8vw, 48px);
}
.workflow-graph .workflow-visual {
  height: 400px;
  margin: 40px 0 0;
}
.workflow-graph img {
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
  .workflow-graph {
    display: block;
    min-height: 0;
  }
  .workflow-copy,
  .workflow-graph .workflow-copy {
    padding: 28px 24px 16px;
  }
  .workflow-visual,
  .workflow-graph .workflow-visual {
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
