<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { iconsSet } from './icons'
import { variants } from './variants'

interface Props {
  name: string
  size?: Variants['size']
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="cn(variants({ size }), props.class)"
    :data-icon-name="name"
    v-html="iconsSet[name]"
  />
</template>
