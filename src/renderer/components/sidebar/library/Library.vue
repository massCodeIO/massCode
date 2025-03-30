<script setup lang="ts">
import type { Node } from '@/components/sidebar/folders/types'
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import type { SnippetsQuery } from '~/renderer/services/api/generated'
import Tree from '@/components/sidebar/folders/Tree.vue'
import LibraryItem from '@/components/sidebar/library/Item.vue'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useFolders, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { scrollToElement } from '@/utils'
import { Archive, Inbox, Plus, Star, Trash } from 'lucide-vue-next'

const scrollbarRef = ref<PerfectScrollbarExpose | null>(null)

const { selectedFolderId, selectedLibrary } = useApp()
const { getSnippets, selectFirstSnippet, searchQuery, emptyTrash }
  = useSnippets()
const {
  getFolders,
  folders,
  selectFolder,
  createFolderAndSelect,
  updateFolder,
} = useFolders()

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

async function initGetSnippets() {
  const query: SnippetsQuery = {}

  if (selectedFolderId.value) {
    query.folderId = selectedFolderId.value
  }
  else if (selectedLibrary.value === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (selectedLibrary.value === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (selectedLibrary.value === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (selectedLibrary.value === LibraryFilter.Inbox) {
    query.isInbox = 1
  }

  await getSnippets(query)

  nextTick(() => {
    scrollToElement('[data-snippet-item].is-selected')
  })
}

initGetSnippets()

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
    data-sidebar-library
    class="shrink-0"
  >
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
</template>
