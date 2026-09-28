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
  shimmer?: boolean
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
      cn(
        textVariants({ variant, weight, mono, muted, uppercase }),
        shimmer && 'text-shimmer',
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {
  .text-shimmer {
    width: fit-content;
    background-image: linear-gradient(
      110deg,
      var(--muted-foreground) 35%,
      var(--foreground) 50%,
      var(--muted-foreground) 65%
    );
    background-size: 250% 100%;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: text-shimmer 2.4s linear infinite;
  }
}

@keyframes text-shimmer {
  from {
    background-position: 150% 0;
  }
  to {
    background-position: -50% 0;
  }
}
</style>
