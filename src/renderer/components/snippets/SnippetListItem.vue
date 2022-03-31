<template>
  <div
    ref="itemRef"
    class="item"
    :class="{
      'is-selected': !isFocused && isSelected,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted
    }"
    @click="isFocused = true"
    @contextmenu="onClickContextMenu"
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
        {{ folder }}
      </div>
      <div class="date">
        {{ dateFormat }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ipc } from '@/electron'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import type { ContextMenuPayload, ContextMenuResponse } from '@@/types'
import { onClickOutside } from '@vueuse/core'
import { computed, ref } from 'vue'

interface Props {
  id: string
  name: string
  folder: string
  date: number
  isSelected: boolean
}

const props = defineProps<Props>()

const snippetStore = useSnippetStore()
const folderStore = useFolderStore()

const itemRef = ref()
const isFocused = ref(false)
const isHighlighted = ref(false)

onClickOutside(itemRef, () => {
  isFocused.value = false
  isHighlighted.value = false
})

const onClickContextMenu = async () => {
  isHighlighted.value = true

  const { action } = await ipc.invoke<ContextMenuResponse, ContextMenuPayload>(
    'context-menu:snippet',
    {
      name: props.name
    }
  )

  if (action === 'delete') {
    snippetStore.patchSnippetsById(props.id, {
      isDeleted: true
    })

    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
    snippetStore.snippet = snippetStore.snippetsNonDeleted[0]
  }

  if (action === 'duplicate') {
    await snippetStore.duplicateSnippetById(props.id)
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  }

  if (action === 'favorites') {
    snippetStore.patchSnippetsById(props.id, {
      isFavorites: true
    })
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  }

  isHighlighted.value = false
}

const dateFormat = computed(() =>
  new Intl.DateTimeFormat('ru').format(props.date)
)
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
      top: 0px;
      left: 10px;
      right: 10px;
      bottom: 2px;
      border-radius: 5px;
      // z-index: 3;
      outline: 2px solid var(--color-primary);
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
  color: var(--color-contrast-medium);
  padding-top: var(--spacing-sm);
}
</style>
