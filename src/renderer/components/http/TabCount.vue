<script setup lang="ts">
defineProps<{ count: number }>()
</script>

<template>
  <UiText
    v-if="count"
    variant="caption"
    muted
    class="bg-muted ml-1 inline-flex h-4 items-center justify-center rounded px-1.5"
  >
    {{ count }}
  </UiText>
</template>
