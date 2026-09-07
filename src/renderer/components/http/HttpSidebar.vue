<script setup lang="ts">
import {
  useHttpApp,
  useHttpEnvironments,
  useHttpFolders,
  useHttpImportDialog,
  useHttpRequests,
  useHttpSearch,
  useResizeHandle,
} from '@/composables'
import { i18n, store } from '@/electron'
import { Plus, Upload } from 'lucide-vue-next'

import { LAYOUT_DEFAULTS } from '~/main/store/constants'

const ENVIRONMENTS_PANEL_DEFAULTS
  = LAYOUT_DEFAULTS.http.environmentsPanel ?? LAYOUT_DEFAULTS.tags

const environmentsHandleRef = ref<HTMLElement>()

function normalizeEnvironmentsHeight(value: number | undefined) {
  if (
    typeof value !== 'number'
    || Number.isNaN(value)
    || value < ENVIRONMENTS_PANEL_DEFAULTS.min
  ) {
    return ENVIRONMENTS_PANEL_DEFAULTS.height
  }
  return value
}

const environmentsHeight = ref(
  normalizeEnvironmentsHeight(
    store.app.get('http.layout.environmentsListHeight') as number | undefined,
  ),
)

useResizeHandle(environmentsHandleRef, {
  direction: 'vertical',
  onMove(dy) {
    environmentsHeight.value = Math.max(
      ENVIRONMENTS_PANEL_DEFAULTS.min,
      environmentsHeight.value - dy,
    )
  },
  onEnd() {
    store.app.set(
      'http.layout.environmentsListHeight',
      environmentsHeight.value,
    )
  },
})

const { httpState } = useHttpApp()
const { createHttpFolderAndSelect, getHttpFolders } = useHttpFolders()
const { getHttpRequests } = useHttpRequests()
const { getHttpEnvironments } = useHttpEnvironments()
const { searchQuery } = useHttpSearch()
const { isHttpImportDialogOpen, openHttpImportDialog } = useHttpImportDialog()
const sectionTitle = computed(() => {
  const labels: Record<string, string> = {
    inbox: i18n.t('common.inbox'),
    favorites: i18n.t('common.favorites'),
    all: i18n.t('spaces.http.allRequests'),
    trash: i18n.t('common.trash'),
  }
  return (
    labels[httpState.libraryFilter ?? '']
    || i18n.t('spaces.http.tree.collections')
  )
})
async function onImported() {
  await Promise.allSettled([
    getHttpFolders(false),
    getHttpRequests(),
    getHttpEnvironments(),
  ])
}
</script>

<template>
  <div
    class="flex h-full flex-col px-1"
    style="
      padding-top: calc(var(--content-top-offset) + var(--header-gap, 0px));
    "
  >
    <SidebarHeader
      :title="i18n.t('spaces.http.title')"
      :section-title="i18n.t('common.library')"
    >
      <template #actions>
        <UiActionButton
          :tooltip="i18n.t('spaces.http.action.import')"
          :aria-label="i18n.t('spaces.http.action.import')"
          @click="openHttpImportDialog"
        >
          <Upload class="size-4" />
        </UiActionButton>
      </template>
    </SidebarHeader>
    <HttpImportDialog
      v-model:open="isHttpImportDialogOpen"
      @imported="onImported"
    />
    <HttpSidebarLibrary />
    <div class="flex min-h-0 flex-1 flex-col">
      <SidebarSectionHeader :title="sectionTitle">
        <template #action>
          <UiActionButton
            :tooltip="i18n.t('spaces.http.tree.newCollection')"
            :aria-label="i18n.t('spaces.http.tree.newCollection')"
            @click="createHttpFolderAndSelect()"
          >
            <Plus class="size-4" />
          </UiActionButton>
        </template>
      </SidebarSectionHeader>
      <HttpRequestsListHeader />
      <HttpTreeLive :query="searchQuery" />
      <div
        ref="environmentsHandleRef"
        class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex h-px shrink-0 cursor-row-resize items-center justify-center bg-transparent before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:transition-[background-color,height] before:duration-150 before:content-[''] after:absolute after:inset-x-0 after:top-1/2 after:h-3 after:-translate-y-1/2 after:content-[''] hover:before:h-0.5 hover:before:delay-200 data-[resizing]:before:h-0.5"
      />

      <div
        :style="{ height: `${environmentsHeight}px` }"
        class="shrink-0 overflow-hidden"
      >
        <HttpEnvironmentsPanel />
      </div>
    </div>
  </div>
</template>
