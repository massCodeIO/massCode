<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { variants } from './variants'

interface Props {
  variant?: Variants['variant']
  size?: Variants['size']
  class?: string
  active?: boolean
}

const props = defineProps<Props>()
</script>

<template>
  <button
    :class="
      cn(variants({ variant, size }), props.class, {
        'bg-button-hover/70 text-white': active,
      })
    "
  >
    <slot />
  </button>
</template>
