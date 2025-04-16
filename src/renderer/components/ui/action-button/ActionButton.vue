<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'

interface Props {
  tooltip?: string
  active?: boolean
  type?: 'icon' | 'iconText'
}

withDefaults(defineProps<Props>(), {
  type: 'icon',
})
</script>

<template>
  <Tooltip.TooltipProvider v-if="tooltip">
    <Tooltip.Tooltip>
      <Tooltip.TooltipTrigger as-child>
        <UiButton
          variant="icon"
          :size="type"
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
    :size="type"
  >
    <slot />
  </UiButton>
</template>
