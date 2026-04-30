<script setup lang="ts">
import { useHttpRequests } from '@/composables'

const { currentRequest } = useHttpRequests()
</script>

<template>
  <div class="flex h-full flex-col pt-[var(--content-top-offset)]">
    <div class="min-h-0 flex-1 basis-3/5">
      <HttpRequestEditor />
    </div>
    <div
      v-if="currentRequest"
      class="border-border min-h-0 flex-1 basis-2/5 border-t"
    >
      <HttpResponsePanel />
    </div>
  </div>
</template>
