<template>
  <div class="main">
    <TheSidebar />
    <SnippetList />
    <TheEditor
      v-model="snippet"
      v-model:lang="lang"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const snippet = ref(
  `declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
};

const x = 1
let a = 'some'
`
)
const lang = ref()
</script>

<style scoped lang="scss">
.main {
  display: grid;
  height: 100vh;
  background-color: var(--color-bg);
  overflow: hidden;
  grid-template-columns: 200px 200px 1fr;
}
.update-available {
  position: absolute;
  top: 2px;
  right: var(--spacing-xs);
  font-size: var(--text-xs);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--color-text);
  &:hover {
    text-decoration: underline;
  }
  z-index: 1020;
}
</style>
