<script setup lang="ts">
interface Props {
  label: string
  isActive?: boolean
}

defineProps<Props>()
</script>

<template>
  <div
    class="hover:bg-list-selection flex items-center rounded-md"
    :class="{ 'bg-list-selection text-list-selection-fg': isActive }"
  >
    <div class="ml-5.5 truncate select-none">
      {{ label }}
    </div>
  </div>
</template>
