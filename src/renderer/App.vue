<script setup lang="ts">
import { useApp } from '@/composables'

useApp()
</script>

<template>
  <div
    data-title-bar
    class="absolute top-0 h-[var(--title-bar-height)] w-full select-none z-50"
  />
  <RouterView />
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
