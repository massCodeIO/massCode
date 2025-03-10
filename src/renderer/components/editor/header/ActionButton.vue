<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'

interface Props {
  tooltip?: string
}

defineProps<Props>()
</script>

<template>
  <Tooltip.TooltipProvider>
    <Tooltip.Tooltip>
      <Tooltip.TooltipTrigger as-child>
        <UiButton
          variant="icon"
          size="icon"
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
</template>
