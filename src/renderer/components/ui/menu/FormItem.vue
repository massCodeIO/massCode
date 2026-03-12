<script setup lang="ts">
import { cn } from '@/utils'

interface Props {
  label: string
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="cn('grid max-w-3xl grid-cols-[200px_1fr] gap-2', props.class)">
    <div>
      {{ label }}
    </div>
    <div class="space-y-2">
      <slot />
      <UiText
        v-if="$slots.description"
        as="div"
        variant="base"
        muted
      >
        <slot name="description" />
      </UiText>
      <div v-if="$slots.actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
