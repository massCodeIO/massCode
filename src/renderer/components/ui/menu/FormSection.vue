<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
</script>

<template>
  <div class="[&:not(:first-child)]:mt-5">
    <div class="pb-2 text-xs font-bold uppercase">
      {{ label }}
    </div>
    <div class="space-y-5">
      <slot />
    </div>
  </div>
</template>
