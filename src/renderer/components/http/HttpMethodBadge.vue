<script setup lang="ts">
import type { HttpMethod } from '~/main/types/http'
import { cn } from '@/utils'
import { cva } from 'class-variance-authority'

interface Props {
  method: HttpMethod
  size?: 'xs' | 'sm'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'xs',
})

const variants = cva('font-mono font-semibold tracking-tight', {
  variants: {
    method: {
      GET: 'text-emerald-600 dark:text-emerald-400',
      POST: 'text-amber-600 dark:text-amber-400',
      PUT: 'text-blue-600 dark:text-blue-400',
      PATCH: 'text-violet-600 dark:text-violet-400',
      DELETE: 'text-rose-600 dark:text-rose-400',
      HEAD: 'text-cyan-600 dark:text-cyan-400',
      OPTIONS: 'text-zinc-600 dark:text-zinc-400',
    },
    size: {
      xs: 'text-[10px]',
      sm: 'text-xs',
    },
  },
})

function shortLabel(method: HttpMethod): string {
  return method === 'OPTIONS' ? 'OPT' : method === 'DELETE' ? 'DEL' : method
}
</script>

<template>
  <span
    :class="
      cn(variants({ method: props.method, size: props.size }), props.class)
    "
  >
    {{ shortLabel(props.method) }}
  </span>
</template>
