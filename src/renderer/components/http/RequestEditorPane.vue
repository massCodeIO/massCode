<script setup lang="ts">
import { useHttpRequests, useResizeHandle } from '@/composables'
import { store } from '@/electron'

const { currentRequest } = useHttpRequests()

const RESPONSE_PANEL_DEFAULT_HEIGHT = 300
const RESPONSE_PANEL_MIN_HEIGHT = 120
const REQUEST_EDITOR_MIN_HEIGHT = 220

const rootRef = ref<HTMLElement>()
const responseHandleRef = ref<HTMLElement>()
const responsePanelRef = ref<HTMLElement>()

function normalizeResponseHeight(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }
  if (value < RESPONSE_PANEL_MIN_HEIGHT) {
    return RESPONSE_PANEL_DEFAULT_HEIGHT
  }
  return value
}

const responsePanelHeight = ref(
  normalizeResponseHeight(
    store.app.get('http.layout.responsePanelHeight') as number | undefined,
  ),
)

function getCurrentResponseHeight() {
  return (
    responsePanelHeight.value
    ?? responsePanelRef.value?.getBoundingClientRect().height
    ?? RESPONSE_PANEL_DEFAULT_HEIGHT
  )
}

function clampResponseHeight(value: number) {
  const maxHeight = (() => {
    const rootHeight = rootRef.value?.clientHeight ?? 0
    if (!rootHeight) {
      return value
    }
    return Math.max(
      RESPONSE_PANEL_MIN_HEIGHT,
      rootHeight - REQUEST_EDITOR_MIN_HEIGHT,
    )
  })()

  return Math.min(Math.max(RESPONSE_PANEL_MIN_HEIGHT, value), maxHeight)
}

useResizeHandle(responseHandleRef, {
  direction: 'vertical',
  onStart() {
    responsePanelHeight.value = clampResponseHeight(getCurrentResponseHeight())
  },
  onMove(dy) {
    responsePanelHeight.value = clampResponseHeight(
      getCurrentResponseHeight() - dy,
    )
  },
  onEnd() {
    if (responsePanelHeight.value !== undefined) {
      store.app.set(
        'http.layout.responsePanelHeight',
        responsePanelHeight.value,
      )
    }
  },
})
</script>

<template>
  <div
    ref="rootRef"
    class="flex h-full flex-col overflow-hidden pt-[var(--content-top-offset)]"
  >
    <div
      class="min-h-0 flex-1"
      :class="{
        'basis-3/5': currentRequest && responsePanelHeight === undefined,
      }"
    >
      <HttpRequestEditor />
    </div>
    <div
      v-if="currentRequest"
      ref="responseHandleRef"
      class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex h-px shrink-0 cursor-row-resize items-center justify-center bg-transparent before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:transition-[background-color,height] before:duration-150 before:content-[''] after:absolute after:inset-x-0 after:top-1/2 after:h-3 after:-translate-y-1/2 after:content-[''] hover:before:h-0.5 hover:before:delay-200 data-[resizing]:before:h-0.5"
    />
    <div
      v-if="currentRequest"
      ref="responsePanelRef"
      :style="
        responsePanelHeight === undefined
          ? undefined
          : { height: `${responsePanelHeight}px` }
      "
      class="min-h-0 overflow-hidden"
      :class="
        responsePanelHeight === undefined ? 'flex-1 basis-2/5' : 'shrink-0'
      "
    >
      <HttpResponsePanel />
    </div>
  </div>
</template>
