<script setup lang="ts">
import type { Node } from '@/components/sidebar/folders/types'
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import Tree from '@/components/sidebar/folders/Tree.vue'
import LibraryItem from '@/components/sidebar/library/Item.vue'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useFolders, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, store } from '@/electron'
import { scrollToElement } from '@/utils'
import { Archive, Inbox, Plus, Star, Trash } from 'lucide-vue-next'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'radix-vue'

const scrollbarRef = ref<PerfectScrollbarExpose | null>(null)

const { state } = useApp()
const {
  getSnippets,
  selectFirstSnippet,
  emptyTrash,
  isRestoreStateBlocked,
  clearSearch,
} = useSnippets()
const {
  getFolders,
  folders,
  selectFolder,
  createFolderAndSelect,
  updateFolder,
  selectedFolderIds,
} = useFolders()

const tagsListHeight = store.app.get('sizes.tagsListHeight') as number

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
    scrollToElement(`[id="${state.folderId}"]`)
  })
}

initGetFolders()

async function initGetSnippets() {
  await getSnippets()

  nextTick(() => {
    scrollToElement('[data-snippet-item].is-selected')
  })
}

initGetSnippets()

async function onFolderClick({
  id,
  event,
}: {
  id: number
  event?: MouseEvent
}) {
  if (event?.shiftKey) {
    await selectFolder(id, { mode: 'range', ensureVisibility: false })
    return
  }

  if (event && (event.metaKey || event.ctrlKey)) {
    await selectFolder(id, { mode: 'toggle', ensureVisibility: false })
    return
  }

  if (state.folderId !== id || selectedFolderIds.value.length > 1) {
    isRestoreStateBlocked.value = true
    clearSearch()

    await selectFolder(id)
    await getSnippets({ folderId: id })
    selectFirstSnippet()
  }
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
  nodes,
  target,
  position,
}: {
  nodes: Node[]
  target: Node
  position: 'before' | 'after' | 'center'
}) {
  try {
    // Фильтруем узлы, исключая целевой, чтобы избежать перемещения папки в себя
    const movableNodes = nodes.filter(node => node.id !== target.id)

    if (!movableNodes.length) {
      return
    }

    if (position === 'center') {
      // Перемещение внутрь целевой папки
      const destinationParentId = Number(target.id)
      let orderIndex = target.children?.length || 0

      for (const node of movableNodes) {
        await updateFolder(node.id, {
          parentId: destinationParentId,
          orderIndex,
        })
        orderIndex += 1
      }

      return
    }

    // Перемещение до или после целевой папки
    for (const node of movableNodes) {
      const isDraggingUp = node.orderIndex > target.orderIndex

      const newParentId: number | null = target.parentId || null
      let newOrderIndex: number

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

      await updateFolder(node.id, {
        parentId: newParentId,
        orderIndex: newOrderIndex,
      })
    }
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

function onResizeTagList(val: number[]) {
  store.app.set('sizes.tagsListHeight', val[1])
}
</script>

<template>
  <SplitterGroup
    id="1"
    direction="vertical"
    @layout="onResizeTagList"
  >
    <div
      class="shrink-0 overflow-hidden"
      data-sidebar-library
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div class="px-1">
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
            {{ i18n.t("action.delete.trash") }}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </div>
    <div class="mt-1 flex items-center justify-between py-1 pl-1 select-none">
      <div class="text-[10px] font-bold uppercase">
        {{ i18n.t("sidebar.folders") }}
      </div>
      <UiActionButton
        :tooltip="i18n.t('action.new.folder')"
        @click="createFolderAndSelect()"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
    <SplitterPanel as-child>
      <Tree
        v-if="folders?.length"
        v-model="folders"
        class="px-0.5 pb-1"
        @click-node="onFolderClick"
        @toggle-node="onFolderToggle"
        @drag-node="onFolderDrag"
      />

      <UiEmptyPlaceholder
        v-else
        :text="i18n.t('placeholder.emptyFoldersList')"
      />
    </SplitterPanel>
    <SplitterResizeHandle class="relative cursor-none">
      <UiGutter orientation="horizontal" />
    </SplitterResizeHandle>
    <div class="flex items-center justify-between py-1 pl-1 select-none">
      <div class="text-[10px] font-bold uppercase">
        {{ i18n.t("sidebar.tags") }}
      </div>
    </div>
    <SplitterPanel
      as-child
      :default-size="tagsListHeight"
    >
      <SidebarTags class="px-1 pb-1" />
    </SplitterPanel>
  </SplitterGroup>
</template>
