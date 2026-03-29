<script setup lang="ts">
interface Props {
  text: string
}

defineProps<Props>()
</script>

<template>
  <div class="app-version">
    {{ text }}
  </div>
</template>

<style>
.app-version {
  display: inline-flex;
  padding: 0 6px;
  background: rgb(236, 236, 30);
  font-size: 12px;
  font-family: var(--font-code);
  border-radius: 3px;
}

html.dark {
  .app-version {
    background: rgb(180, 180, 24);
    color: black;
  }
}
</style>
