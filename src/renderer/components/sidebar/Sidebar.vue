<script setup lang="ts">
import { useApp, useGutter, useSnippets } from '@/composables'
import { LibraryTab } from '@/composables/types'
import { i18n, store } from '@/electron'
import { APP_DEFAULTS } from '~/main/store/constants'

const sidebarRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const {
  sidebarWidth,
  selectedLibraryTab,
  selectedSnippetIdBeforeTagSelect,
  selectedSnippetId,
  selectedTagId,
} = useApp()
const { clearSnippets } = useSnippets()
const { width } = useGutter(
  sidebarRef,
  gutterRef,
  Number.parseInt(sidebarWidth.value as string),
  APP_DEFAULTS.sizes.sidebar,
)

function onSelectedLibraryTab(
  tab: (typeof LibraryTab)[keyof typeof LibraryTab],
) {
  selectedLibraryTab.value = tab

  if (tab === LibraryTab.Tags) {
    selectedSnippetIdBeforeTagSelect.value = selectedSnippetId.value
  }

  if (tab === LibraryTab.Library) {
    selectedSnippetId.value = selectedSnippetIdBeforeTagSelect.value
    selectedTagId.value = undefined
  }

  clearSnippets()
}

watch(width, () => {
  sidebarWidth.value = `${width.value}px`
  store.app.set('sidebarWidth', width.value)
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
      <div
        :class="selectedLibraryTab === LibraryTab.Tags ? 'text-text-muted' : ''"
        @click="onSelectedLibraryTab(LibraryTab.Library)"
      >
        {{ i18n.t("sidebar.library") }}
      </div>
      /
      <div
        :class="
          selectedLibraryTab === LibraryTab.Library ? 'text-text-muted' : ''
        "
        @click="onSelectedLibraryTab(LibraryTab.Tags)"
      >
        {{ i18n.t("sidebar.tags") }}
      </div>
    </div>
    <SidebarLibrary v-if="selectedLibraryTab === LibraryTab.Library" />
    <SidebarLibraryTags v-else />
    <UiGutter ref="gutterRef" />
  </div>
</template>
