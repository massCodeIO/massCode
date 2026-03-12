<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
</script>

<template>
  <div class="[&:not(:first-child)]:mt-5">
    <UiText
      as="div"
      variant="xs"
      weight="bold"
      uppercase
      class="pb-2"
    >
      {{ label }}
    </UiText>
    <div class="space-y-5">
      <slot />
    </div>
  </div>
</template>
