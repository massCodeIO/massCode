<script setup lang="ts">
import { ArrowRight, Code2, FileText, Globe, Sparkles } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeCard from './HomeCard.vue'

const workflows = [
  {
    icon: Code2,
    title: 'Edit your code',
    description: 'Update snippets and fragments using the code you have open.',
    prompt:
      'Add a five-second timeout to this function and update the usage example.',
  },
  {
    icon: FileText,
    title: 'Organize your notes',
    description:
      'Find records, rewrite notes, and update task properties across your vault.',
    prompt: 'Find overdue tasks and move them to Follow-up.',
  },
  {
    icon: Globe,
    title: 'Test your APIs',
    description:
      'Add checks, run collections with your confirmation, and investigate failed requests.',
    prompt:
      'Run this collection, explain the failed checks, and save a report in Notes.',
  },
]
</script>

<template>
  <section
    id="ai-assistant"
    class="ai-section"
    aria-labelledby="ai-title"
  >
    <header>
      <p class="eyebrow">
        <Sparkles
          :size="16"
          aria-hidden="true"
        /> BUILT-IN AI ASSISTANT
      </p>
      <h2 id="ai-title">
        From a question to a finished task.
      </h2>
      <p class="intro">
        Ask massCode to edit code, organize notes, or work through an HTTP
        workflow. Find what you need in your vault and put it to work in the
        same conversation.
      </p>
    </header>
    <div class="workflows">
      <HomeCard
        v-for="workflow in workflows"
        :key="workflow.title"
        as="article"
        class="workflow"
        glow="left"
      >
        <component
          :is="workflow.icon"
          :size="24"
          class="workflow-icon"
          aria-hidden="true"
        />
        <h3>{{ workflow.title }}</h3>
        <p>{{ workflow.description }}</p>
        <blockquote>{{ workflow.prompt }}</blockquote>
      </HomeCard>
    </div>
    <div class="details">
      <div>
        <h3>Your choice of model.</h3>
        <p>
          Connect OpenAI, Anthropic, Gemini, DeepSeek, Mistral, or xAI with your
          own API key. Or use a model running on your computer with Ollama or LM
          Studio. Cloud API usage is billed by your provider.
        </p>
      </div>
      <div>
        <h3>Apply changes or preview first.</h3>
        <p>
          Have the assistant make edits directly, or ask for a preview first.
          Sending HTTP requests requires your confirmation.
        </p>
      </div>
    </div>
    <a
      class="guide-link"
      :href="withBase('/documentation/ai')"
    >
      Get started with AI Assistant <ArrowRight
        :size="16"
        aria-hidden="true"
      />
    </a>
  </section>
</template>

<style scoped>
.ai-section {
  margin-top: 120px;
  scroll-margin-top: 96px;
}
header {
  text-align: center;
  margin-bottom: 40px;
}
.eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 18px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--home-highlight);
}
h2 {
  font-size: clamp(36px, 4.5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
.intro {
  max-width: 720px;
  margin: 18px auto 0;
  font-size: 18px;
  line-height: 1.65;
  color: var(--home-muted);
}
.workflows {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.workflow {
  display: flex;
  flex-direction: column;
  padding: 28px;
}
.workflow-icon {
  color: var(--home-highlight);
  margin-bottom: 24px;
}
h3 {
  font-size: 21px;
  line-height: 1.3;
  letter-spacing: -0.02em;
}
.workflow > p,
.details p {
  margin-top: 12px;
  color: var(--home-muted);
  font-size: 15px;
  line-height: 1.7;
}
.workflow > p {
  flex: 1;
}
blockquote {
  margin: 24px 0 0;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  font-size: 14px;
  line-height: 1.65;
}
.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  margin-top: 36px;
}
.guide-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 18px;
  color: var(--home-highlight);
  font-size: 15px;
}
.guide-link:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.guide-link:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 5px;
}
@media (max-width: 760px) {
  .ai-section {
    margin-top: 64px;
  }
  .workflows,
  .details {
    grid-template-columns: minmax(0, 1fr);
  }
  .details {
    gap: 24px;
  }
  .intro {
    font-size: 17px;
  }
}
</style>
