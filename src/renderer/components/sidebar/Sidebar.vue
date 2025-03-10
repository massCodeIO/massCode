<script setup lang="ts">
import type { Node } from '@/components/sidebar/folders/types'
import type { FoldersTreeResponse } from '@/services/api/generated'
import { useApp, useGutter, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { store } from '@/electron'
import { api } from '@/services/api'
import { Archive, Inbox, Plus, Star, Trash } from 'lucide-vue-next'
import { APP_DEFAULTS } from '~/main/store/constants'
import Tree from './folders/Tree.vue'
import LibraryItem from './library/Item.vue'

const sidebarRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { sidebarWidth, selectFolder } = useApp()
const { getSnippets, selectFirstSnippet, searchQuery } = useSnippets()

const { width } = useGutter(
  sidebarRef,
  gutterRef,
  Number.parseInt(sidebarWidth.value as string),
  APP_DEFAULTS.sizes.sidebar,
)

const folders = ref<FoldersTreeResponse>()

const libraryItems = [
  { id: LibraryFilter.Inbox, name: 'Inbox', icon: Inbox },
  { id: LibraryFilter.Favorites, name: 'Favorites', icon: Star },
  { id: LibraryFilter.All, name: 'All Snippets', icon: Archive },
  { id: LibraryFilter.Trash, name: 'Trash', icon: Trash },
]

async function getFolders() {
  const { data } = await api.folders.getFoldersTree()
  folders.value = data
}

getFolders()

async function onFolderClick(id: number) {
  selectFolder(id)
  await getSnippets({ folderId: id })
  selectFirstSnippet()

  searchQuery.value = ''
}

async function onFolderToggle(node: Node) {
  try {
    const { id, name, icon, defaultLanguage, parentId, isOpen, orderIndex }
      = node

    await api.folders.putFoldersById(String(id), {
      name,
      icon,
      defaultLanguage,
      parentId,
      isOpen: !isOpen ? 1 : 0,
      orderIndex,
    })

    await getFolders()
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

    await api.folders.putFoldersById(String(node.id), {
      name: node.name,
      icon: node.icon || null,
      defaultLanguage: node.defaultLanguage || 'plain_text',
      parentId: newParentId,
      isOpen: node.isOpen ? 1 : 0,
      orderIndex: newOrderIndex,
    })

    await getFolders()
  }
  catch (error) {
    console.error('Folder update error:', error)
  }
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
    <div class="flex-shrink-0 pt-2">
      <div class="pb-1 pl-1 text-[10px] font-bold uppercase">
        Library / Tags
      </div>
      <div class="">
        <LibraryItem
          v-for="i in libraryItems"
          :id="i.id"
          :key="i.name"
          :name="i.name"
          :icon="i.icon"
        />
      </div>
    </div>
    <div class="flex items-center justify-between pt-2 pl-1">
      <div class="text-[10px] font-bold uppercase">
        Folders
      </div>
      <UiButton
        variant="icon"
        size="icon"
      >
        <Plus class="h-4 w-4" />
      </UiButton>
    </div>
    <div class="flex-grow overflow-auto">
      <Tree
        v-if="folders"
        v-model="folders"
        @click-node="onFolderClick"
        @toggle-node="onFolderToggle"
        @drag-node="onFolderDrag"
      />
    </div>
    <UiGutter ref="gutterRef" />
  </div>
</template>
