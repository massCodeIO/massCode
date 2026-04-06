<script setup lang="ts">
interface Props {
  title: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <section class="bg-card border-border flex h-full flex-col rounded-xl border">
    <header
      class="border-border flex items-start justify-between gap-3 border-b px-4 py-3"
    >
      <div class="min-w-0">
        <h2 class="truncate text-sm font-semibold">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="text-muted-foreground mt-1 text-xs"
        >
          {{ description }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div class="min-h-0 flex-1 p-4">
      <slot />
    </div>
  </section>
</template>
