<script setup lang="ts">
import type { AppStore } from '~/main/store/types'
import {
  useHttpApp,
  useHttpEnvironments,
  useHttpFolders,
  useHttpImportDialog,
  useHttpRequests,
  useHttpSearch,
  useResizeHandle,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, store } from '@/electron'
import { useElementSize } from '@vueuse/core'
import { Plus, Trash2, Upload } from 'lucide-vue-next'

const { httpState } = useHttpApp()
const { createHttpFolderAndSelect, getHttpFolders } = useHttpFolders()
const {
  getHttpRequests,
  getAllHttpRequests,
  emptyTrash,
  currentRequest,
  trashRequests,
} = useHttpRequests()
const { getHttpEnvironments, environments } = useHttpEnvironments()
const { searchQuery, resetHttpSearchState } = useHttpSearch()
const { isHttpImportDialogOpen, openHttpImportDialog } = useHttpImportDialog()
const layout = store.app.get('http.layout') as AppStore['http']['layout']
const collectionsOpen = ref(layout.collectionsOpen !== false)
const environmentsOpen = ref(layout.environmentsOpen !== false)
const trashOpen = ref(layout.trashOpen === true)
const unfiledOpen = ref(layout.unfiledOpen !== false)
const favorites = ref(
  layout.favoritesOnly === true
  || httpState.libraryFilter === LibraryFilter.Favorites,
)
if (
  httpState.libraryFilter === LibraryFilter.Favorites
  || httpState.libraryFilter === LibraryFilter.All
) {
  httpState.libraryFilter = undefined
}
const environmentsHeight = ref(
  Math.max(80, layout.environmentsListHeight || 220),
)
const trashHeight = ref(Math.max(80, layout.trashHeight || 160))
const sections = ref<HTMLElement>()
const collectionsSection = ref<HTMLElement>()
const environmentsSection = ref<HTMLElement>()
const trashSection = ref<HTMLElement>()
const { height } = useElementSize(sections)
const environmentsHandle = ref<HTMLElement>()
const trashHandle = ref<HTMLElement>()
const resizeClass
  = 'before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 h-0 shrink-0 cursor-row-resize before:absolute before:inset-x-0 before:top-0 before:h-px after:absolute after:inset-x-0 after:-top-1 after:h-3'
const available = computed(() => Math.max(0, height.value - 108))
const trashSize = computed(() =>
  Math.min(
    trashHeight.value,
    Math.max(
      40,
      available.value
      - (collectionsOpen.value ? 60 : 0)
      - (environmentsOpen.value ? 60 : 0),
    ),
  ),
)
const environmentSize = computed(() =>
  Math.min(
    environmentsHeight.value,
    Math.max(
      40,
      available.value - (trashOpen.value ? trashSize.value : 0) - 60,
    ),
  ),
)

// Measure the visible pair: a section can fill the remaining space when its
// preceding sections are collapsed, regardless of its persisted height.
let resizeUpper = 0
let resizeLower = 0
let resizeOffset = 0
function startResize(
  upper: HTMLElement | undefined,
  lower: HTMLElement | undefined,
) {
  resizeUpper = Math.max(0, (upper?.getBoundingClientRect().height ?? 36) - 36)
  resizeLower = Math.max(0, (lower?.getBoundingClientRect().height ?? 36) - 36)
  resizeOffset = 0
}
function resizeDelta(dy: number, upperMinimum: number) {
  resizeOffset += dy
  return Math.max(
    Math.min(0, upperMinimum - resizeUpper),
    Math.min(Math.max(0, resizeLower - 80), resizeOffset),
  )
}

watch(
  [collectionsOpen, environmentsOpen, trashOpen, unfiledOpen, favorites],
  () => {
    store.app.set('http.layout.collectionsOpen', collectionsOpen.value)
    store.app.set('http.layout.environmentsOpen', environmentsOpen.value)
    store.app.set('http.layout.trashOpen', trashOpen.value)
    store.app.set('http.layout.unfiledOpen', unfiledOpen.value)
    store.app.set('http.layout.favoritesOnly', favorites.value)
  },
)
useResizeHandle(environmentsHandle, {
  direction: 'vertical',
  onStart() {
    startResize(collectionsSection.value, environmentsSection.value)
  },
  onMove(dy) {
    environmentsHeight.value = resizeLower - resizeDelta(dy, 60)
  },
  onEnd() {
    store.app.set(
      'http.layout.environmentsListHeight',
      environmentsHeight.value,
    )
  },
})
useResizeHandle(trashHandle, {
  direction: 'vertical',
  onStart() {
    startResize(
      environmentsOpen.value
        ? environmentsSection.value
        : collectionsSection.value,
      trashSection.value,
    )
  },
  onMove(dy) {
    const delta = resizeDelta(dy, environmentsOpen.value ? 80 : 60)
    trashHeight.value = resizeLower - delta
    if (environmentsOpen.value)
      environmentsHeight.value = resizeUpper + delta
  },
  onEnd() {
    store.app.set('http.layout.trashHeight', trashHeight.value)
    if (environmentsOpen.value) {
      store.app.set(
        'http.layout.environmentsListHeight',
        environmentsHeight.value,
      )
    }
  },
})
watch(
  () => currentRequest.value?.id,
  () => {
    if (currentRequest.value?.isDeleted) {
      trashOpen.value = true
    }
    else if (currentRequest.value) {
      collectionsOpen.value = true
      if (currentRequest.value.folderId === null)
        unfiledOpen.value = true
    }
  },
  { immediate: true },
)
watch(
  () => httpState.activePanel,
  (panel) => {
    if (panel === 'folder')
      collectionsOpen.value = true
  },
)
watch([searchQuery, favorites], () => {
  if (searchQuery.value || favorites.value)
    collectionsOpen.value = true
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (
    query
    && environments.value.some(env =>
      env.name.toLocaleLowerCase().includes(query),
    )
  ) {
    environmentsOpen.value = true
  }
  if (
    query
    && trashRequests.value.some(request =>
      `${request.name} ${request.method} ${request.url}`
        .toLocaleLowerCase()
        .includes(query),
    )
  ) {
    trashOpen.value = true
  }
})
resetHttpSearchState()
async function onImported() {
  await Promise.allSettled([
    getHttpFolders(false),
    getHttpRequests(),
    getAllHttpRequests(),
    getHttpEnvironments(),
  ])
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col px-1 pt-[var(--content-top-offset)]">
    <HttpRequestsListHeader v-model:favorites="favorites">
      <template #actions>
        <UiActionButton
          :tooltip="i18n.t('spaces.http.action.import')"
          @click="openHttpImportDialog"
        >
          <Upload class="size-4" />
        </UiActionButton>
      </template>
    </HttpRequestsListHeader>
    <div
      ref="sections"
      class="flex min-h-0 flex-1 flex-col"
    >
      <section
        ref="collectionsSection"
        class="flex min-h-0 flex-col"
        :class="collectionsOpen ? 'flex-1' : 'shrink-0'"
      >
        <SidebarSectionHeader
          v-model:open="collectionsOpen"
          collapsible
          :title="i18n.t('spaces.http.tree.collections')"
          class="shrink-0"
        >
          <template #action>
            <UiActionButton
              :tooltip="i18n.t('spaces.http.tree.newCollection')"
              @click="createHttpFolderAndSelect()"
            >
              <Plus class="size-4" />
            </UiActionButton>
          </template>
        </SidebarSectionHeader>
        <HttpTreeLive
          v-show="collectionsOpen"
          v-model:unfiled-open="unfiledOpen"
          :query="searchQuery"
          :favorites="favorites"
        />
      </section>
      <div
        v-if="collectionsOpen && environmentsOpen"
        ref="environmentsHandle"
        :class="resizeClass"
      />
      <section
        ref="environmentsSection"
        class="min-h-0 overflow-hidden border-t"
        :class="!collectionsOpen && environmentsOpen ? 'flex-1' : 'shrink-0'"
        :style="{
          height: environmentsOpen ? `${environmentSize + 36}px` : '36px',
        }"
      >
        <HttpEnvironmentsPanel
          v-model:open="environmentsOpen"
          :query="searchQuery"
        />
      </section>
      <div
        v-if="trashOpen && (collectionsOpen || environmentsOpen)"
        ref="trashHandle"
        :class="resizeClass"
      />
      <section
        ref="trashSection"
        class="flex min-h-0 flex-col border-t"
        :class="
          !collectionsOpen && !environmentsOpen && trashOpen
            ? 'flex-1'
            : 'shrink-0'
        "
        :style="{ height: trashOpen ? `${trashSize + 36}px` : '36px' }"
      >
        <SidebarSectionHeader
          v-model:open="trashOpen"
          collapsible
          :title="i18n.t('common.trash')"
          class="shrink-0"
        >
          <template #action>
            <UiActionButton
              :tooltip="i18n.t('action.delete.trash')"
              @click="emptyTrash"
            >
              <Trash2 class="size-4" />
            </UiActionButton>
          </template>
        </SidebarSectionHeader>
        <HttpTreeLive
          v-show="trashOpen"
          trash
          :query="searchQuery"
        />
      </section>
    </div>
    <HttpImportDialog
      v-model:open="isHttpImportDialogOpen"
      @imported="onImported"
    />
  </div>
</template>
