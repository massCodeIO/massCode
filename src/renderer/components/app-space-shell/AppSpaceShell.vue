<script setup lang="ts">
import { useAi } from '@/composables/ai/useAi'
import { useResizeHandle } from '@/composables/useResizeHandle'
import { store } from '@/electron'
import { getSpaceDefinitions } from '@/spaceDefinitions'
import { isMac } from '@/utils'
import { useRoute } from 'vue-router'

const props = withDefaults(defineProps<Props>(), {
  showRail: true,
})
const { open: aiOpen } = useAi()
const route = useRoute()
const supported = computed(() =>
  getSpaceDefinitions().some(
    space => space.id === 'code' && space.isActive(route.name),
  ),
)
const handle = ref<HTMLElement>()
const width = ref(store.app.get<number>('code.layout.inspectorWidth') ?? 340)
useResizeHandle(handle, {
  direction: 'horizontal',
  onMove: (delta) => {
    width.value = Math.max(280, Math.min(800, width.value - delta))
  },
  onEnd: () => store.app.set('code.layout.inspectorWidth', width.value),
})

interface Props {
  showRail?: boolean
}
</script>

<template>
  <div
    class="grid h-screen overflow-hidden"
    :class="props.showRail ? 'grid-cols-[72px_1fr]' : 'grid-cols-[1fr]'"
  >
    <div
      v-if="props.showRail"
      class="bg-background border-border/70 border-r"
      :class="isMac && 'pt-2.5'"
    >
      <SpaceRail />
    </div>
    <div class="flex min-h-0 min-w-0 overflow-hidden">
      <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
        <slot />
      </div>
      <template v-if="props.showRail && supported && aiOpen">
        <div
          ref="handle"
          class="bg-border hover:bg-primary relative z-10 w-px shrink-0 cursor-col-resize after:absolute after:inset-y-0 after:-left-1 after:w-2"
        />
        <aside
          :style="{ width: `${width}px`, maxWidth: '65%' }"
          class="h-full min-h-0 shrink-0 overflow-hidden"
        >
          <AiPanel />
        </aside>
      </template>
    </div>
  </div>
</template>
