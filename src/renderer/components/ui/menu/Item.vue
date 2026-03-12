<script setup lang="ts">
interface Props {
  label: string
  isActive?: boolean
}

defineProps<Props>()
</script>

<template>
  <div
    class="flex items-center rounded-md"
    :class="
      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent-hover'
    "
  >
    <div class="ml-5.5 truncate select-none">
      {{ label }}
    </div>
  </div>
</template>
