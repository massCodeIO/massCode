<script setup lang="ts">
import type { HttpMethod } from '~/main/types/http'
import { Badge } from '@/components/ui/shadcn/badge'
import { cn } from '@/utils'
import { cva } from 'class-variance-authority'

interface Props {
  method: HttpMethod
  protocol?: 'http' | 'websocket'
  size?: 'xs' | 'sm'
  compact?: boolean
  appearance?: 'text' | 'chip'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'xs',
  appearance: 'text',
})

const label = computed(() => {
  if (props.protocol === 'websocket')
    return 'WS'
  if (props.compact && props.method === 'DELETE')
    return 'DEL'
  if (props.compact && props.method === 'OPTIONS')
    return 'OPT'
  return props.method
})

const variants = cva('font-mono font-semibold tracking-tight uppercase', {
  variants: {
    appearance: {
      text: '',
      chip: 'h-5 w-16 border-current/20 bg-current/10 px-1.5 py-0',
    },
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
</script>

<template>
  <component
    :is="props.appearance === 'chip' ? Badge : 'span'"
    :variant="props.appearance === 'chip' ? 'outline' : undefined"
    :data-method="props.method"
    :title="props.protocol === 'websocket' ? 'WebSocket' : props.method"
    :class="
      cn(
        variants({
          method: props.protocol === 'websocket' ? undefined : props.method,
          size: props.size,
          appearance: props.appearance,
        }),
        props.protocol === 'websocket' ? 'text-primary' : '',
        props.class,
      )
    "
  >
    {{ label }}
  </component>
</template>
