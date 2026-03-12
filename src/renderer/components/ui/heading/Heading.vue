<script setup lang="ts">
interface Props {
  title: string
  description?: string
  level?: 2 | 3
}

const props = withDefaults(defineProps<Props>(), {
  level: 2,
})

const levelStyles = computed(() => {
  return {
    'text-lg font-bold': props.level === 2,
    'text-md font-bold': props.level === 3,
  }
})
</script>

<template>
  <div class="mb-3 not-first:mt-3">
    <component
      :is="`h${level}`"
      :class="levelStyles"
    >
      {{ title }}
    </component>
    <UiText
      v-if="description"
      as="p"
      variant="base"
      muted
    >
      {{ description }}
    </UiText>
  </div>
</template>
