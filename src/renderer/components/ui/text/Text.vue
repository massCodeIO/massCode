<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { TextVariants } from '.'
import { cn } from '@/utils'
import { Primitive } from 'reka-ui'
import { textVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: TextVariants['variant']
  weight?: TextVariants['weight']
  mono?: boolean
  muted?: boolean
  uppercase?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'span',
  mono: false,
  muted: false,
  uppercase: false,
})
</script>

<template>
  <Primitive
    data-slot="text"
    :data-variant="variant"
    :data-weight="weight"
    :as="as"
    :as-child="asChild"
    :class="
      cn(textVariants({ variant, weight, mono, muted, uppercase }), props.class)
    "
  >
    <slot />
  </Primitive>
</template>
