<script setup lang="ts">
import { PanelBottom, PanelLeft, PanelRight } from 'lucide-vue-next'

const props = defineProps<{
  side: 'left' | 'bottom' | 'right'
  open: boolean
}>()
const icons = { left: PanelLeft, bottom: PanelBottom, right: PanelRight }
const fills = {
  left: 'M5 3h4v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  right: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4Z',
  bottom: 'M3 15h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
}
</script>

<template>
  <component
    :is="icons[props.side]"
    aria-hidden="true"
  >
    <path
      v-if="open"
      :d="fills[props.side]"
      fill="currentColor"
      stroke="none"
    />
  </component>
</template>
