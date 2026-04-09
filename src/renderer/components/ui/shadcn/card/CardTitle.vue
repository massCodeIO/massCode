<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <UiText
    as="h3"
    variant="base"
    weight="semibold"
    data-slot="card-title"
    :class="cn(props.class)"
  >
    <slot />
  </UiText>
</template>
