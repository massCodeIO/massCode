<script setup lang="ts">
import { isMac } from '@/utils'
</script>

<template>
  <div class="grid h-screen grid-cols-[72px_1fr] overflow-hidden">
    <div
      class="bg-background border-border/70 border-r"
      :class="isMac && 'mt-2.5'"
    >
      <SpaceRail />
    </div>
    <div class="min-h-0 min-w-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
