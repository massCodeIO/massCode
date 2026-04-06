<script setup lang="ts">
import { useResizeHandle } from '@/composables'
import { LAYOUT_DEFAULTS } from '~/main/store/constants'

const props = withDefaults(
  defineProps<{
    showSidebar: boolean
    showList: boolean
    sidebarWidth?: number
    listWidth?: number
    headerGap?: number
  }>(),
  {
    sidebarWidth: LAYOUT_DEFAULTS.sidebar.width,
    listWidth: LAYOUT_DEFAULTS.list.width,
    headerGap: 0,
  },
)

const emit = defineEmits<{
  resizeEnd: [sidebarWidth: number, listWidth: number]
  twoPanelResize: [listWidth: number]
}>()

const containerRef = ref<HTMLElement>()
const sidebarHandleRef = ref<HTMLElement>()
const listHandleRef = ref<HTMLElement>()

const internalSidebarWidth = ref(props.sidebarWidth)
const internalListWidth = ref(props.listWidth)

function clampWidth(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getMaxWidth(excludeWidth: number) {
  const total = containerRef.value?.clientWidth || window.innerWidth
  return total - excludeWidth - LAYOUT_DEFAULTS.editor.min
}

const { isResizing: isSidebarResizing } = useResizeHandle(sidebarHandleRef, {
  direction: 'horizontal',
  onMove(dx) {
    const max = getMaxWidth(props.showList ? internalListWidth.value : 0)
    internalSidebarWidth.value = clampWidth(
      internalSidebarWidth.value + dx,
      LAYOUT_DEFAULTS.sidebar.min,
      max,
    )
  },
  onEnd() {
    emit('resizeEnd', internalSidebarWidth.value, internalListWidth.value)
  },
})

const { isResizing: isListResizing } = useResizeHandle(listHandleRef, {
  direction: 'horizontal',
  onMove(dx) {
    const exclude = props.showSidebar ? internalSidebarWidth.value : 0
    const max = getMaxWidth(exclude)
    internalListWidth.value = clampWidth(
      internalListWidth.value + dx,
      LAYOUT_DEFAULTS.list.min,
      max,
    )
  },
  onEnd() {
    if (props.showSidebar) {
      emit('resizeEnd', internalSidebarWidth.value, internalListWidth.value)
    }
    else {
      emit('twoPanelResize', internalListWidth.value)
    }
  },
})

const isResizing = computed(
  () => isSidebarResizing.value || isListResizing.value,
)
</script>

<template>
  <div
    v-if="!showList && !showSidebar"
    class="h-screen"
  >
    <slot name="editor" />
  </div>
  <div
    v-else-if="!showList"
    ref="containerRef"
    class="flex h-screen"
  >
    <div
      :style="{ width: `${internalSidebarWidth}px` }"
      class="shrink-0 overflow-hidden"
    >
      <div
        class="h-full"
        :style="{ '--header-gap': `${props.headerGap}px` }"
      >
        <slot name="sidebar" />
      </div>
    </div>
    <div
      ref="sidebarHandleRef"
      class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex w-px shrink-0 cursor-col-resize items-center justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:transition-[background-color,width] before:duration-150 before:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 after:content-[''] hover:before:w-0.5 hover:before:delay-200 data-[resizing]:before:w-0.5"
    />
    <div class="min-w-0 flex-1 overflow-hidden">
      <slot name="editor" />
    </div>
    <div
      v-if="isResizing"
      class="fixed inset-0 z-50 cursor-col-resize"
    />
  </div>
  <div
    v-else
    ref="containerRef"
    class="flex h-screen"
  >
    <div
      v-if="showSidebar"
      :style="{ width: `${internalSidebarWidth}px` }"
      class="shrink-0 overflow-hidden"
    >
      <div
        class="h-full"
        :style="{ '--header-gap': `${props.headerGap}px` }"
      >
        <slot name="sidebar" />
      </div>
    </div>
    <div
      v-if="showSidebar"
      ref="sidebarHandleRef"
      class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex w-px shrink-0 cursor-col-resize items-center justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:transition-[background-color,width] before:duration-150 before:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 after:content-[''] hover:before:w-0.5 hover:before:delay-200 data-[resizing]:before:w-0.5"
    />
    <div
      :style="{ width: `${internalListWidth}px` }"
      class="shrink-0 overflow-hidden"
    >
      <slot name="list" />
    </div>
    <div
      ref="listHandleRef"
      class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex w-px shrink-0 cursor-col-resize items-center justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:transition-[background-color,width] before:duration-150 before:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 after:content-[''] hover:before:w-0.5 hover:before:delay-200 data-[resizing]:before:w-0.5"
    />
    <div class="min-w-0 flex-1 overflow-hidden">
      <slot name="editor" />
    </div>
    <div
      v-if="isResizing"
      class="fixed inset-0 z-50 cursor-col-resize"
    />
  </div>
</template>
