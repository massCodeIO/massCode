<template>
  <div
    ref="itemRef"
    class="item"
    :class="{
      'is-selected': isSelected,
      'is-focused': isFocused,
      'is-system': isSystem,
      'is-tag': isTag
    }"
    @click="isFocused = true"
    @contextmenu="onClickContextMenu"
  >
    <span class="icon">
      <Component
        :is="AngleRight"
        v-if="nested"
        class="nested"
        :class="{ open: open }"
      />
      <Component
        :is="icon || Folder"
        v-if="!model?.icon"
      />

      <AppFolderIconsItem
        v-else
        class="folder"
        :name="(model.icon as string)"
      />
    </span>
    <div class="name">
      <div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FunctionalComponent } from 'vue'
import { watch, ref } from 'vue'
import Folder from '~icons/unicons/folder'
import AngleRight from '~icons/unicons/angle-right'
import { onClickOutside } from '@vueuse/core'
import { ipc } from '@/electron'
import { track } from '@/services/analytics'
import type {
  ContextMenuRequest,
  ContextMenuResponse,
  ContextMenuType
} from '@shared/types/main'
import { useFolderStore } from '@/store/folders'
import { useTagStore } from '@/store/tags'
import type { FolderTree } from '@shared/types/main/db'
import { useSnippetStore } from '@/store/snippets'
import { emitter } from '@/composable'
import { onScrollToFolder } from './composable'
import { useAppStore } from '@/store/app'

interface Props {
  id?: string
  icon?: FunctionalComponent
  isSystem?: boolean
  nested?: boolean
  open?: boolean
  isSelected?: boolean
  isTag?: boolean
  isFolder?: boolean
  model?: FolderTree
  alias?: ContextMenuType
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  nested: false,
  open: false
})

const appStore = useAppStore()
const folderStore = useFolderStore()
const snippetStore = useSnippetStore()
const tagStore = useTagStore()

const isFocused = ref(false)
const itemRef = ref()

const onClickContextMenu = async () => {
  if (props.isFolder) {
    const { action, type, data } = await ipc.invoke<
    ContextMenuRequest,
    ContextMenuResponse
    >('context-menu:library', {
      name: props.model?.name,
      type: 'folder',
      data: JSON.parse(JSON.stringify(props.model))
    })

    if (action === 'set-custom-icon') {
      appStore.showModal = true
      folderStore.selectedContextId = props.model?.id
    }

    if (action === 'new') {
      await folderStore.addNewFolder()
      track('folders/add-new')
    }

    if (action === 'delete') {
      await folderStore.deleteFoldersById(props.id!)
      track('folders/delete')
    }

    if (action === 'rename') {
      emitter.emit('folder:rename', props.id!)
    }

    if (action === 'update:language') {
      await folderStore.patchFoldersById(props.id!, { defaultLanguage: data })
      track('folders/set-language', data)
    }

    if (action === 'collapse-all') {
      folderStore.openFolders('close')
    }

    if (action === 'expand-all') {
      folderStore.openFolders('open')
    }
  }

  if (props.alias) {
    const { action, type, data } = await ipc.invoke<
    ContextMenuRequest,
    ContextMenuResponse
    >('context-menu:library', {
      name: props.name,
      type: 'trash',
      data: {}
    })

    if (action === 'delete') {
      snippetStore.emptyTrash()
      await snippetStore.getSnippets()
      track('app/empty-trash')

      if (folderStore.selectedAlias === 'trash') {
        snippetStore.setSnippetsByAlias('trash')
      }
    }
  }

  if (props.isTag) {
    const { action, type, data } = await ipc.invoke<
    ContextMenuRequest,
    ContextMenuResponse
    >('context-menu:library', {
      name: props.name,
      type: 'tag',
      data: {}
    })

    if (action === 'delete') {
      await tagStore.deleteTagById(props.id!)
      track('tags/delete')

      if (props.id === tagStore.selectedId) {
        tagStore.selectedId = undefined
      }

      if (tagStore.tags.length) {
        const firstTagId = tagStore.tags[0].id
        tagStore.selectedId = firstTagId
        snippetStore.setSnippetsByTagId(firstTagId)
      } else {
        snippetStore.selected = undefined
        snippetStore.snippets = []
      }
    }
  }
}

onClickOutside(itemRef, () => {
  isFocused.value = false
})

onScrollToFolder(isFocused)

watch(
  () => props.isSelected,
  v => {
    if (!v) isFocused.value = false
  }
)
</script>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  padding: 4px 0;
  position: relative;
  width: 100%;
  z-index: 2;
  user-select: none;
  &.is-system,
  &.is-tag {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }
  &.is-focused,
  &.is-selected,
  &.is-highlighted {
    &::before {
      content: '';
      position: absolute;
      top: 0px;
      left: 0px;
      right: 0px;
      bottom: 0px;
      border-radius: 5px;
      z-index: -1;
    }
    :deep(svg) {
      fill: var(--color-sidebar-icon-selected);
    }
  }
  &.is-focused {
    &.is-system,
    &.is-tag {
      color: #fff;
      :deep(svg) {
        fill: #fff;
      }
    }
    .icon {
      :deep(svg) {
        fill: var(--color-sidebar-icon-selected);
      }
    }
  }
  &.is-selected {
    &::before {
      background-color: var(--color-sidebar-item-selected);
    }

    &.is-focused {
      &::before {
        background-color: var(--color-primary);
      }
    }
  }
  .icon {
    margin-right: var(--spacing-xs);
    display: flex;
    align-items: center;
    height: 1.2em;
    :deep(svg) {
      fill: var(--color-sidebar-icon);
    }
  }
  .nested {
    position: absolute;
    left: 0;
    &.open {
      transform: rotate(90deg);
    }
  }
  .name {
    user-select: none;
    display: table;
    table-layout: fixed;
    width: 90%;
    overflow: hidden;
    > div {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
  }
}
</style>
