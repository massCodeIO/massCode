<script setup lang="ts">
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  Code2,
  FileText,
  Folder,
  Globe,
} from 'lucide-vue-next'
import { withBase } from 'vitepress'
import HomeCard from './HomeCard.vue'
</script>

<template>
  <section
    class="mcp-section"
    aria-labelledby="mcp-title"
  >
    <header>
      <h2 id="mcp-title">
        Connect your external AI agent.
      </h2>
      <p>
        Already working in an AI client? Let it find saved snippets, read
        project notes, and run HTTP requests through MCP.
      </p>
    </header>
    <HomeCard
      class="mcp-card"
      glow="right"
    >
      <div class="mcp-copy">
        <h3>Bring your saved context into the conversation.</h3>
        <p>
          Reuse what you already know. Save the next useful solution back to
          massCode.
        </p>
        <a :href="withBase('/documentation/mcp')">Connect your agent <ArrowRight
          :size="16"
          aria-hidden="true"
        /></a>
      </div>
      <div
        class="connection"
        role="img"
        aria-label="An AI agent connects to massCode through MCP to access snippets, notes, and HTTP requests."
      >
        <div
          class="connection-flow"
          aria-hidden="true"
        >
          <div class="connection-node">
            <div class="node-icon">
              <Bot :size="30" />
            </div>
            <span>AI agent</span>
          </div>
          <div class="connection-bridge">
            <span>MCP</span>
            <div class="connection-line">
              <ArrowLeftRight :size="22" />
            </div>
          </div>
          <div class="connection-node">
            <div class="node-icon vault-icon">
              <Folder :size="30" />
            </div>
            <span>massCode</span>
          </div>
        </div>
        <div
          class="resources"
          aria-hidden="true"
        >
          <span><Code2 :size="16" />Snippets</span>
          <span><FileText :size="16" />Notes</span>
          <span><Globe :size="16" />HTTP requests</span>
        </div>
      </div>
    </HomeCard>
  </section>
</template>

<style scoped>
.mcp-section {
  margin-top: 120px;
}
header {
  text-align: center;
  margin-bottom: 40px;
}
h2 {
  font-size: clamp(36px, 4.5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
header > p {
  max-width: 660px;
  margin: 18px auto 0;
  font-size: 18px;
  line-height: 1.65;
  color: var(--home-muted);
}
.mcp-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 64px;
  padding: 48px;
}
h3 {
  margin-top: 0;
  font-size: clamp(24px, 2.6vw, 32px);
  line-height: 1.2;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.mcp-copy > p {
  margin-top: 18px;
  color: var(--home-muted);
  font-size: 16px;
  line-height: 1.7;
}
a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 18px;
  color: var(--home-highlight);
  font-size: 15px;
}
a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
a:focus-visible {
  outline: 2px solid var(--home-highlight);
  outline-offset: 5px;
}
.connection {
  min-width: 0;
  padding: 40px 24px 28px;
  border-radius: 14px;
  background: rgb(0 0 0 / 16%);
  box-shadow: 0 12px 24px rgb(0 0 0 / 12%);
}
.connection-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(60px, 1fr) minmax(0, 1fr);
  align-items: start;
  max-width: 380px;
  margin: 0 auto;
}
.connection-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  font-size: 14px;
}
.node-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg-soft);
  color: var(--home-muted);
}
.vault-icon {
  color: var(--home-highlight);
}
.connection-bridge {
  padding-top: 9px;
  color: var(--home-muted);
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.08em;
}
.connection-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: var(--home-highlight);
}
.connection-line::before,
.connection-line::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--vp-c-divider);
}
.resources {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--home-muted);
  font-size: 12px;
}
.resources > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
@media (max-width: 760px) {
  .mcp-section {
    margin-top: 64px;
  }
  .mcp-card {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
    padding: 28px 20px;
  }
  header > p {
    font-size: 17px;
  }
  .connection {
    padding: 28px 14px 22px;
  }
  .node-icon {
    width: 60px;
    height: 60px;
    border-radius: 15px;
  }
  .connection-bridge {
    padding-top: 3px;
  }
  .connection-node {
    font-size: 13px;
  }
  .resources {
    gap: 10px 14px;
  }
}
</style>
