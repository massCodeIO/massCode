<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex h-9 items-center justify-between py-1 pl-1 select-none">
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
    >
      {{ title }}
    </UiText>
    <slot name="action" />
  </div>
</template>
