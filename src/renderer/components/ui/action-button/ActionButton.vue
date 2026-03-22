<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tooltip from '@/components/ui/shadcn/tooltip'

interface Props {
  tooltip?: string
  size?: 'icon' | 'iconText'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'icon',
})
</script>

<template>
  <Tooltip.Tooltip v-if="tooltip">
    <Tooltip.TooltipTrigger as-child>
      <Button
        variant="icon"
        :size="props.size"
        v-bind="$attrs"
      >
        <slot />
      </Button>
    </Tooltip.TooltipTrigger>
    <Tooltip.TooltipContent>
      {{ tooltip }}
    </Tooltip.TooltipContent>
  </Tooltip.Tooltip>
  <Button
    v-else
    variant="icon"
    :size="props.size"
    v-bind="$attrs"
  >
    <slot />
  </Button>
</template>
