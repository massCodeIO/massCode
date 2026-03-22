<script setup lang="ts">
import { isMac } from '@/utils'

interface Props {
  showRail?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRail: true,
})
</script>

<template>
  <div
    class="grid h-screen overflow-hidden"
    :class="props.showRail ? 'grid-cols-[72px_1fr]' : 'grid-cols-[1fr]'"
  >
    <div
      v-if="props.showRail"
      class="bg-background border-border/70 border-r"
      :class="isMac && 'mt-2.5'"
    >
      <SpaceRail />
    </div>
    <div class="min-h-0 min-w-0 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
