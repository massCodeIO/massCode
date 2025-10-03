<script setup lang="ts">
import { useApp } from '@/composables'

const { isSidebarHidden } = useApp()
</script>

<template>
  <div
    class="grid h-screen"
    :class="[
      isSidebarHidden
        ? 'grid-cols-1'
        : 'grid-cols-[var(--sidebar-width)_var(--snippet-list-width)_1fr]',
    ]"
  >
    <Sidebar v-show="!isSidebarHidden" />
    <SnippetList v-show="!isSidebarHidden" />
    <Editor />
  </div>
</template>
