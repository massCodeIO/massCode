<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { isMac } from '@/utils'

interface Props {
  tooltip?: string
  shortcut?: string
  size?: 'icon' | 'iconText'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'icon',
})

const tooltipText = computed(() => {
  if (!props.shortcut)
    return props.tooltip

  const shortcut = props.shortcut
    .split('+')
    .map((key) => {
      if (key === 'CommandOrControl')
        return isMac ? '⌘' : 'Ctrl'
      if (key === 'Alt')
        return isMac ? '⌥' : 'Alt'
      if (key === 'Shift')
        return isMac ? '⇧' : 'Shift'
      if (key === 'ArrowLeft')
        return '←'
      if (key === 'ArrowRight')
        return '→'
      if (key === 'Escape')
        return 'Esc'
      if (key === 'Enter')
        return isMac ? '↵' : 'Enter'
      return key
    })
    .join(isMac ? '' : '+')

  return `${props.tooltip} (${shortcut})`
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
      {{ tooltipText }}
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
