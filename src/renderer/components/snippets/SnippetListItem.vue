<template>
  <div
    ref="itemRef"
    class="item"
    :class="{
      'is-selected': !isFocused && isSelected,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted || isHighlightedMultiple
    }"
    :draggable="true"
    @click="onClickSnippet"
    @contextmenu="onClickContextMenu"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="header">
      <div class="name">
        <span>
          {{ name || 'Untitled snippet' }}
        </span>
      </div>
    </div>
    <div class="footer">
      <div class="folder">
        {{ folder || 'Inbox' }}
      </div>
      <div class="date">
        {{ dateFormat }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ipc, track } from '@/electron'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import type {
  ContextMenuRequest,
  ContextMenuResponse
} from '@shared/types/main'
import { onClickOutside } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { SystemFolderAlias } from '@shared/types/renderer/sidebar'
import { useTagStore } from '@/store/tags'
import { isToday, format } from 'date-fns'

interface Props {
  id: string
  index: number
  name: string
  folder?: string
  date: number
}

const props = defineProps<Props>()

const snippetStore = useSnippetStore()
const folderStore = useFolderStore()
const tagStore = useTagStore()

const itemRef = ref()
const isFocused = ref(false)
const isHighlighted = ref(false)

const isSelected = computed(() => {
  if (snippetStore.selectedId) {
    return props.id === snippetStore.selectedId
  } else {
    return snippetStore.selectedMultiple?.some(i => i.id === props.id)
  }
})

const isHighlightedMultiple = computed(() => {
  if (snippetStore.selectedMultiple && snippetStore.isContextState) {
    return snippetStore.selectedMultiple?.some(i => i.id === props.id)
  }
  return false
})

onClickOutside(itemRef, () => {
  isFocused.value = false
  isHighlighted.value = false
})

const onClickSnippet = (e: MouseEvent) => {
  if (e.shiftKey) {
    if (snippetStore.selectedIndex < props.index) {
      snippetStore.selectedMultiple = snippetStore.snippets.slice(
        snippetStore.selectedIndex,
        props.index + 1
      )
    } else {
      snippetStore.selectedMultiple = snippetStore.snippets.slice(
        props.index,
        snippetStore.selectedIndex + 1
      )
    }
    snippetStore.selected = undefined
    isFocused.value = false
  } else {
    isFocused.value = true
    snippetStore.fragment = 0
    snippetStore.selectedMultiple = []
    snippetStore.getSnippetsById(props.id)
    tagStore.getTags()
  }
}

const onClickContextMenu = async () => {
  isHighlighted.value = true
  snippetStore.isContextState = true

  ipc.once('context-menu:close', () => {
    isHighlighted.value = false
    snippetStore.isContextState = false
  })

  const { action, data, type } = await ipc.invoke<
  ContextMenuRequest,
  ContextMenuResponse
  >('context-menu:snippet', {
    name: props.name,
    type: folderStore.selectedAlias ?? 'folder',
    selectedCount: snippetStore.selectedMultiple.length
  })

  const moveToTrash = async (alias?: SystemFolderAlias) => {
    if (snippetStore.selectedIds.length) {
      for (const id of snippetStore.selectedIds) {
        await snippetStore.patchSnippetsById(id, {
          isDeleted: true
        })
      }
    } else {
      await snippetStore.patchSnippetsById(props.id, {
        isDeleted: true
      })
    }
    if (!alias) {
      await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
      snippetStore.selected = snippetStore.snippets[0]
    } else {
      await snippetStore.getSnippets()
      snippetStore.setSnippetsByAlias(alias)
    }
  }

  if (action === 'delete') {
    if (type === 'folder') {
      await moveToTrash()
      track('snippets/move-to-trash')
    }

    if (type === 'favorites' || type === 'all' || type === 'inbox') {
      await moveToTrash(type)
    }

    if (type === 'trash') {
      if (snippetStore.selectedIds.length) {
        await snippetStore.deleteSnippetsByIds(snippetStore.selectedIds)
      } else {
        await snippetStore.deleteSnippetsById(props.id)
      }
      await snippetStore.getSnippets()
      snippetStore.setSnippetsByAlias(type)
    }
  }

  if (action === 'duplicate') {
    await snippetStore.duplicateSnippetById(props.id)
    track('snippets/duplicate')

    if (type === 'folder') {
      await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
    }

    if (type === 'all' || type === 'inbox') {
      await snippetStore.getSnippets()
      snippetStore.setSnippetsByAlias(type)
    }
  }

  if (action === 'favorites') {
    snippetStore.patchSnippetsById(props.id, {
      isFavorites: data
    })

    if (data) {
      track('snippets/add-to-favorites')
    } else {
      track('snippets/delete-from-favorites')
    }

    if (type === 'folder') {
      await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
    }

    if (type === 'favorites') {
      await snippetStore.getSnippets()
      snippetStore.setSnippetsByAlias(type)
    }
  }

  isHighlighted.value = false
  isFocused.value = false
  snippetStore.isContextState = false
  snippetStore.selected = undefined
  snippetStore.selectedMultiple = []
}

const dateFormat = computed(() => {
  const date = new Date(props.date)
  if (isToday(date)) return format(date, 'HH:mm')
  return format(date, 'dd.MM.yyyy')
})

const onDragStart = (e: DragEvent) => {
  if (snippetStore.selectedIds.length) {
    e.dataTransfer?.setData('payload', JSON.stringify(snippetStore.selectedIds))

    const count = snippetStore.selectedIds.length
    const el = document.createElement('div')
    const style = {
      padding: '2px 10px',
      backgroundColor: 'var(--color-bg)',
      borderRadius: '3px',
      color: 'var(--color-text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      fontSize: '14px',
      top: '100%'
    }
    el.innerHTML = `${count} ${count > 1 ? 'items' : 'item'}`

    Object.assign(el.style, style)
    document.body.appendChild(el)

    e.dataTransfer?.setDragImage(el, 0, 0)
    setTimeout(() => el.remove(), 0)
  } else {
    e.dataTransfer?.setData('payload', JSON.stringify([props.id]))
  }
}

const onDragEnd = () => {
  folderStore.hoveredId = ''
}
</script>

<style lang="scss" scoped>
.item {
  padding: var(--spacing-xs) var(--spacing-sm);
  position: relative;
  z-index: 2;
  user-select: none;
  &::after {
    content: '';
    height: 1px;
    background-color: var(--color-border);
    position: absolute;
    width: calc(100% - calc(var(--spacing-sm) * 2));
    bottom: 1px;
  }
  &.is-focused,
  &.is-selected,
  &.is-highlighted {
    &::before {
      content: '';
      position: absolute;
      top: 0px;
      left: 8px;
      right: 8px;
      bottom: 0px;
      border-radius: 5px;
      z-index: 1;
    }
  }
  &.is-focused {
    &::before {
      background-color: var(--color-primary);
    }
    .name,
    .footer {
      color: #fff;
    }
  }
  &.is-selected {
    &::before {
      background-color: var(--color-snippet-selected);
    }
    .name,
    .footer {
      color: var(--color-text);
    }
  }
  &.is-highlighted {
    &::before {
      border-radius: 5px;
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }
  }
}
.name {
  display: table;
  table-layout: fixed;
  width: 100%;
  overflow: hidden;
  position: relative;
  z-index: 1;
  line-height: 24px;
  span {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
}
.footer {
  font-size: 11px;
  display: flex;
  position: relative;
  z-index: 1;
  justify-content: space-between;
  color: var(--color-text-3);
  padding-top: var(--spacing-sm);
}
</style>
