<script setup lang="ts">
import { useHttpExecute } from '@/composables'

const { lastResponse } = useHttpExecute()
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="!lastResponse"
      class="flex flex-1 items-center justify-center"
    >
      <UiText class="text-muted-foreground text-sm">
        No response yet
      </UiText>
    </div>
    <div
      v-else
      class="flex-1 overflow-auto p-3"
    >
      <UiText class="text-muted-foreground text-xs">
        TODO: status / headers / body
      </UiText>
    </div>
  </div>
</template>
