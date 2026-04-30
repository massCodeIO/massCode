<script setup lang="ts">
import { useHttpRequests } from '@/composables'

const { currentRequest } = useHttpRequests()
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="!currentRequest"
      class="flex flex-1 items-center justify-center"
    >
      <UiText class="text-muted-foreground text-sm">
        Select a request
      </UiText>
    </div>
    <div
      v-else
      class="flex-1 overflow-auto p-3"
    >
      <UiText class="text-muted-foreground text-xs">
        TODO: method/url/send + tabs
      </UiText>
    </div>
  </div>
</template>
