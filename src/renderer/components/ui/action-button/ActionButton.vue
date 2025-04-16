<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'

interface Props {
  tooltip?: string
  active?: boolean
}

defineProps<Props>()
</script>

<template>
  <Tooltip.TooltipProvider v-if="tooltip">
    <Tooltip.Tooltip>
      <Tooltip.TooltipTrigger as-child>
        <UiButton
          variant="icon"
          size="icon"
          :active="active"
          v-bind="$attrs"
        >
          <slot />
        </UiButton>
      </Tooltip.TooltipTrigger>
      <Tooltip.TooltipContent>
        {{ tooltip }}
      </Tooltip.TooltipContent>
    </Tooltip.Tooltip>
  </Tooltip.TooltipProvider>
  <UiButton
    v-else
    variant="icon"
    v-bind="$attrs"
    :active="active"
    size="icon"
  >
    <slot />
  </UiButton>
</template>
