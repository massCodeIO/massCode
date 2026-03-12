<script setup lang="ts">
interface Props {
  label: string
  isActive?: boolean
}

defineProps<Props>()
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-md px-2 py-1"
    :class="
      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent-hover'
    "
  >
    <div
      v-if="$slots.icon"
      class="text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center"
    >
      <slot name="icon" />
    </div>
    <div
      class="truncate select-none"
      :class="!$slots.icon && 'ml-3.5'"
    >
      {{ label }}
    </div>
  </div>
</template>
