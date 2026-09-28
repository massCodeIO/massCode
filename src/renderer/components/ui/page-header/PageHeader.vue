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
      <UiText
        as="h1"
        variant="xl"
        weight="semibold"
      >
        {{ title }}
      </UiText>
      <UiText
        as="p"
        variant="base"
        muted
        class="mt-1"
      >
        {{ description }}
      </UiText>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
