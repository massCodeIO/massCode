<script setup lang="ts">
defineProps<{
  description: string
  title: string
}>()
</script>

<template>
  <div
    class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
  >
    <div>
      <h1 class="text-xl font-semibold">
        {{ title }}
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ description }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
