<script setup lang="ts">
interface Props {
  text: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="text-text-muted flex h-full items-center justify-center text-center"
  >
    {{ text }}
  </div>
</template>
