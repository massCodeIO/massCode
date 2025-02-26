<script setup lang="ts">
import type { Node } from '@/components/ui/app-tree/types'
import type { FoldersTreeResponse } from '~/renderer/services/api/generated'
import { useApp, useGutter } from '@/composables'
import { APP_DEFAULTS } from '~/main/store/constants'
import { store } from '~/renderer/electron'
import { api } from '~/renderer/services/api'

const sidebarRef = ref<HTMLElement>()
const gutterRef = ref<{ $el: HTMLElement }>()

const { sidebarWidth } = useApp()

const { width } = useGutter(
  sidebarRef,
  gutterRef,
  Number.parseInt(sidebarWidth.value as string),
  APP_DEFAULTS.sizes.sidebar,
)

const folders = ref<FoldersTreeResponse>()

async function getFolders() {
  const { data } = await api.folders.getFoldersTree()
  folders.value = data
}

getFolders()

async function handleNodeClick(id: string | number) {
  // eslint-disable-next-line no-console
  console.log('Папка выбрана:', id)
  // TODO обрабатываем клик по папке
}

async function handleNodeToggle(node: Node) {
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
    console.error('Ошибка при обновлении папки:', error)
  }
}

async function handleNodeDrag({
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
    console.error('Ошибка при перетаскивании папки:', error)
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
    class="relative pt-[var(--title-bar-height)] flex flex-col h-screen"
  >
    <div class="flex-shrink-0">
      Library
    </div>
    <div class="flex-grow overflow-auto">
      <UiAppTree
        v-if="folders"
        v-model="folders"
        @click-node="handleNodeClick"
        @toggle-node="handleNodeToggle"
        @drag-node="handleNodeDrag"
      />
    </div>
    <UiGutter ref="gutterRef" />
  </div>
</template>
