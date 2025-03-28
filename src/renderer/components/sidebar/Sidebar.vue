<script setup lang="ts">
import type { Node } from '@/components/sidebar/folders/types'
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useFolders, useGutter, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, store } from '@/electron'
import { scrollToElement } from '@/utils'
import { Archive, Inbox, Plus, Star, Trash } from 'lucide-vue-next'
import { APP_DEFAULTS } from '~/main/store/constants'
import Tree from './folders/Tree.vue'
import LibraryItem from './library/Item.vue'

const sidebarRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()
const scrollbarRef = ref<PerfectScrollbarExpose | null>(null)

const { sidebarWidth, selectedFolderId } = useApp()
const { getSnippets, selectFirstSnippet, searchQuery, emptyTrash }
  = useSnippets()
const {
  getFolders,
  folders,
  selectFolder,
  createFolderAndSelect,
  updateFolder,
} = useFolders()
const { width } = useGutter(
  sidebarRef,
  gutterRef,
  Number.parseInt(sidebarWidth.value as string),
  APP_DEFAULTS.sizes.sidebar,
)

const libraryItems = [
  { id: LibraryFilter.Inbox, name: i18n.t('sidebar.inbox'), icon: Inbox },
  {
    id: LibraryFilter.Favorites,
    name: i18n.t('sidebar.favorites'),
    icon: Star,
  },
  { id: LibraryFilter.All, name: i18n.t('sidebar.allSnippets'), icon: Archive },
  { id: LibraryFilter.Trash, name: i18n.t('sidebar.trash'), icon: Trash },
]

async function initGetFolders() {
  await getFolders()

  nextTick(() => {
    scrollToElement(`[id="${selectedFolderId.value}"]`)
  })
}

initGetFolders()

async function onFolderClick(id: number) {
  if (selectedFolderId.value !== id) {
    await getSnippets({ folderId: id })
    selectFolder(id)
    selectFirstSnippet()
  }

  searchQuery.value = ''
}

async function onFolderToggle(node: Node) {
  try {
    const { id, isOpen } = node

    updateFolder(id, { isOpen: !isOpen ? 1 : 0 })
  }
  catch (error) {
    console.error('Folder update error:', error)
  }
}

async function onFolderDrag({
  node,
  target,
  position,
}: {
  node: Node
  target: Node
  position: string
}) {
  try {
    const isDraggingUp = node.orderIndex > target.orderIndex

    // Определяем новые значения для parentId и orderIndex
    let newParentId: number | null = null
    let newOrderIndex: number = 0

    if (position === 'center') {
      // Перемещение внутрь целевой папки
      newParentId = Number(target.id)
      newOrderIndex = target.children?.length || 0
    }
    else {
      // Перемещение до или после целевой папки
      newParentId = target.parentId || null
      if (node.parentId === target.parentId) {
        // Если перемещаем внутри одного списка, корректируем по направлению и позиции
        if (position === 'after') {
          newOrderIndex = isDraggingUp
            ? target.orderIndex + 1
            : target.orderIndex
        }
        else {
          newOrderIndex = isDraggingUp
            ? target.orderIndex
            : Math.max(target.orderIndex - 1, 0)
        }
      }
      else {
        // Если перемещение в другой родительский элемент
        newOrderIndex
          = position === 'after' ? target.orderIndex + 1 : target.orderIndex
      }
    }

    updateFolder(node.id, {
      parentId: newParentId,
      orderIndex: newOrderIndex,
    })
  }
  catch (error) {
    console.error('Folder update error:', error)
  }
}

watch(width, () => {
  sidebarWidth.value = `${width.value}px`
  store.app.set('sidebarWidth', width.value)
})

watch(folders, () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      scrollbarRef.value.ps?.update()
    }
  })
})
</script>

<template>
  <div
    ref="sidebarRef"
    data-sidebar
    class="relative flex h-screen flex-col px-1 pt-[var(--title-bar-height)]"
  >
    <div class="flex-shrink-0 pt-2">
      <div class="pb-1 pl-1 text-[10px] font-bold uppercase">
        {{ i18n.t("sidebar.library") }} / {{ i18n.t("sidebar.tags") }}
      </div>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div class="">
            <LibraryItem
              v-for="i in libraryItems"
              :id="i.id"
              :key="i.name"
              :name="i.name"
              :icon="i.icon"
            />
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item @click="emptyTrash">
            {{ i18n.t("emptyTrash") }}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </div>
    <div class="flex items-center justify-between pt-2 pl-1">
      <div class="text-[10px] font-bold uppercase">
        {{ i18n.t("sidebar.folders") }}
      </div>
      <UiActionButton
        :tooltip="i18n.t('newFolder')"
        @click="createFolderAndSelect"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
    <PerfectScrollbar ref="scrollbarRef">
      <div class="flex-grow">
        <Tree
          v-if="folders"
          v-model="folders"
          @click-node="onFolderClick"
          @toggle-node="onFolderToggle"
          @drag-node="onFolderDrag"
        />
      </div>
    </PerfectScrollbar>
    <UiGutter ref="gutterRef" />
  </div>
</template>
