<script setup lang="ts">
import { useApp, useGutter } from '@/composables'
import { APP_DEFAULTS } from '~/main/store/constants'
import { store } from '~/renderer/electron'

const sidebarRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { sidebarWidth } = useApp()

const { width } = useGutter(
  sidebarRef,
  gutterRef,
  Number.parseInt(sidebarWidth.value as string),
  APP_DEFAULTS.sizes.sidebar,
)

watch(width, () => {
  sidebarWidth.value = `${width.value}px`
  store.app.set('sidebarWidth', width.value)
})
</script>

<template>
  <div
    ref="sidebarRef"
    data-sidebar
    class="relative pt-[var(--title-bar-height)]"
  >
    sidebar
    <UiGutter ref="gutterRef" />
  </div>
</template>
