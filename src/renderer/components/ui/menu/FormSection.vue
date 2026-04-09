<script setup lang="ts">
import * as Card from '@/components/ui/shadcn/card'
import { cn } from '@/utils'

interface Props {
  label: string
  description?: string
  variant?: 'default' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  variant: 'default',
})
</script>

<template>
  <div>
    <div class="mb-2 px-1">
      <h3
        class="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
      >
        {{ label }}
      </h3>
      <p
        v-if="description"
        class="text-muted-foreground mt-0.5 text-xs"
      >
        {{ description }}
      </p>
    </div>
    <Card.Card
      :class="
        cn(
          props.variant === 'danger'
            && 'border-destructive/20 bg-[color-mix(in_oklch,var(--destructive)_5%,var(--card))]',
        )
      "
    >
      <Card.CardContent class="p-5">
        <div
          class="divide-border/40 divide-y [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
        >
          <slot />
        </div>
      </Card.CardContent>
    </Card.Card>
  </div>
</template>
