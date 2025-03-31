<script setup lang="ts">
import { useApp, useGutter } from '@/composables'
import { i18n, store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const sidebarRef = ref<HTMLElement>()
const sidebarGutterRef = ref<{ $el: HTMLElement }>()

const { sidebarWidth } = useApp()

const { width: sidebarWidthG } = useGutter({
  target: sidebarRef,
  gutter: sidebarGutterRef,
  orientation: 'vertical',
  options: {
    minWidth: APP_DEFAULTS.sizes.sidebar,
  },
})

watch(sidebarWidthG, () => {
  sidebarWidth.value = `${sidebarWidthG.value}px`
  store.app.set('sizes.sidebarWidth', sidebarWidthG.value)
})
</script>

<template>
  <div
    ref="sidebarRef"
    data-sidebar
    class="relative flex h-screen flex-col px-1 pt-[var(--title-bar-height)]"
  >
    <div
      class="flex gap-1 pt-2 pb-1 pl-1 text-[10px] font-bold uppercase select-none"
    >
      {{ i18n.t("sidebar.library") }}
    </div>
    <SidebarLibrary />
    <UiGutter ref="sidebarGutterRef" />
  </div>
</template>
