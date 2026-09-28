<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Alert } from '@/components/ui/shadcn/alert'
import { cn } from '@/utils'
import { cva } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    variant?: 'info' | 'success' | 'warning' | 'error'
    layout?: 'card' | 'panel'
    title?: string
    class?: HTMLAttributes['class']
  }>(),
  { variant: 'info', layout: 'card' },
)

const variants = cva('text-foreground shrink-0 gap-x-2', {
  variants: {
    variant: {
      info: 'border-border bg-muted/30 [&>svg]:text-muted-foreground',
      success: 'border-success/25 bg-success/5 [&>svg]:text-success',
      warning: 'border-warning/25 bg-warning/5 [&>svg]:text-warning',
      error: 'border-destructive/25 bg-destructive/5 [&>svg]:text-destructive',
    },
    layout: {
      card: 'rounded-md p-3',
      panel: 'rounded-none border-x-0 border-t-0 px-3 py-2',
    },
  },
})
const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}
</script>

<template>
  <Alert
    :role="variant === 'error' ? 'alert' : 'status'"
    :class="
      cn(
        variants({ variant, layout }),
        title ? '[&>svg]:translate-y-0.5' : '[&>svg]:translate-y-0',
        props.class,
      )
    "
  >
    <component
      :is="icons[variant]"
      aria-hidden="true"
    />
    <div class="min-w-0 space-y-1">
      <UiText
        v-if="title"
        as="div"
        variant="sm"
        class="font-medium"
      >
        {{ title }}
      </UiText>
      <UiText
        as="div"
        variant="xs"
        class="break-words"
      >
        <slot />
      </UiText>
    </div>
  </Alert>
</template>
