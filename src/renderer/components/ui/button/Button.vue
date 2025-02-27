<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { variants } from './variants'

interface Props {
  variant?: Variants['variant']
  size?: Variants['size']
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <button :class="cn(variants({ variant, size }), props.class)">
    <slot />
  </button>
</template>
