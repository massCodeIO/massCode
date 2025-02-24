<script setup lang="ts">
import { useApp, useGutter } from '@/composables'
import { APP_DEFAULTS } from '~/main/store/constants'
import { store } from '~/renderer/electron'

const listRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { snippetListWidth, sidebarWidth } = useApp()

const offsetWidth = computed(() => {
  return (
    Number.parseInt(sidebarWidth.value as string)
    + Number.parseInt(snippetListWidth.value as string)
  )
})

const { width } = useGutter(
  listRef,
  gutterRef,
  offsetWidth.value,
  APP_DEFAULTS.sizes.snippetList + APP_DEFAULTS.sizes.sidebar,
)

watch(width, () => {
  const _width = width.value - Number.parseInt(sidebarWidth.value as string)

  snippetListWidth.value = `${_width}px`
  store.app.set('snippetListWidth', _width)
})
</script>

<template>
  <div
    ref="listRef"
    data-snippets-list
    class="relative"
  >
    snippet list
    <UiGutter ref="gutterRef" />
  </div>
</template>
