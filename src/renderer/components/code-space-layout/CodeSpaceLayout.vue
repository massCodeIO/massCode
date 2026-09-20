<script setup lang="ts">
import { initCodeSpace, useApp, useSnippets } from '@/composables'
import { useAi } from '@/composables/ai/useAi'
import { getCodePanels } from '@/composables/layoutModes'
import { useResizeHandle } from '@/composables/useResizeHandle'
import { scrollToSnippetIndex } from '@/composables/useSnippetScroller'
import { store } from '@/electron'
import { useElementSize } from '@vueuse/core'

const { open: isAiOpen } = useAi()
const workspace = ref<HTMLElement>()
const inspectorHandle = ref<HTMLElement>()
const { width: workspaceWidth } = useElementSize(workspace)
const inspectorWidth = ref(
  store.app.get<number>('code.layout.inspectorWidth') ?? 340,
)
const panelWidth = computed(() =>
  Math.min(inspectorWidth.value, Math.max(240, workspaceWidth.value - 320)),
)
useResizeHandle(inspectorHandle, {
  direction: 'horizontal',
  onMove: (delta) => {
    inspectorWidth.value = Math.max(
      240,
      Math.min(
        panelWidth.value - delta,
        Math.max(240, workspaceWidth.value - 320),
      ),
    )
  },
  onEnd: () =>
    store.app.set('code.layout.inspectorWidth', inspectorWidth.value),
})
const {
  codeLayoutMode,
  isAppLoading,
  isCodeSpaceInitialized,
  pendingCodeNavigation,
  state,
} = useApp()
const { displayedSnippets } = useSnippets()

const panels = computed(() => getCodePanels(codeLayoutMode.value))

const storedThreePanel = store.app.get('code.layout.threePanel') as
  | number[]
  | undefined

const sidebarWidth
  = storedThreePanel?.length === 2 ? storedThreePanel[0] : undefined
const listWidth = (() => {
  if (storedThreePanel?.length === 2)
    return storedThreePanel[1]
  const twoPanel = store.app.get('code.layout.twoPanel') as number | undefined
  return twoPanel ?? undefined
})()

function onResizeEnd(sw: number, lw: number) {
  store.app.set('code.layout.threePanel', [sw, lw])
}

function onTwoPanelResize(lw: number) {
  store.app.set('code.layout.twoPanel', lw)
}

async function initApp() {
  if (pendingCodeNavigation.value) {
    return
  }

  if (isCodeSpaceInitialized.value) {
    isAppLoading.value = false
    return
  }

  isAppLoading.value = true
  await initCodeSpace()

  nextTick(() => {
    const index
      = displayedSnippets.value?.findIndex(s => s.id === state.snippetId) ?? -1
    if (index >= 0) {
      scrollToSnippetIndex(index)
    }
  })

  isAppLoading.value = false
}

void initApp()
</script>

<template>
  <LayoutThreeColumn
    :show-sidebar="panels.showSidebar"
    :show-list="panels.showList"
    :sidebar-width="sidebarWidth"
    :list-width="listWidth"
    @resize-end="onResizeEnd"
    @two-panel-resize="onTwoPanelResize"
  >
    <template #sidebar>
      <Sidebar />
    </template>
    <template #list>
      <SnippetList />
    </template>
    <template #editor>
      <div
        ref="workspace"
        class="flex h-full min-w-0 overflow-hidden"
      >
        <div class="min-w-0 flex-1">
          <Editor />
        </div>
        <template v-if="isAiOpen">
          <div
            ref="inspectorHandle"
            class="bg-border hover:bg-primary relative z-10 w-px shrink-0 cursor-col-resize after:absolute after:inset-y-0 after:-left-1 after:w-2"
          />
          <aside
            :style="{ width: `${panelWidth}px` }"
            class="h-full min-h-0 shrink-0 overflow-hidden"
          >
            <AiPanel />
          </aside>
        </template>
      </div>
    </template>
  </LayoutThreeColumn>
</template>
