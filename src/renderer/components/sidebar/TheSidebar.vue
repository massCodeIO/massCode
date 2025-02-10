<template>
  <div
    ref="sidebarRef"
    class="sidebar"
  >
    <SidebarList
      v-model="activeTab"
      :tabs="tabs"
      :is-system="true"
    >
      <template v-if="activeTab === 'library'">
        <SidebarListItem
          v-for="i in systemFolders"
          :key="i.name"
          :icon="i.icon"
          :is-system="true"
          :alias="i.alias"
          :is-selected="i.alias === folderStore.selectedAlias"
          @click="onClickSystemFolder(i.alias)"
        >
          {{ i.name }}
        </SidebarListItem>
      </template>
      <template v-if="activeTab === 'tags'">
        <SidebarListItem
          v-for="i in tagStore.tags"
          :id="i.id"
          :key="i.id"
          :name="i.name"
          :icon="LabelAlt"
          :is-tag="true"
          :is-selected="i.id === tagStore.selectedId"
          @click="onClickTag(i.id)"
        >
          {{ i.name }}
        </SidebarListItem>
      </template>
    </SidebarList>
    <SidebarList
      v-if="activeTab === 'library'"
      :is-scrollable="true"
      :title="i18n.t('sidebar.folders')"
      type="folders"
    >
      <template #action>
        <AppActionButton v-tooltip="i18n.t('newFolder')">
          <UniconsPlus @click="onAddNewFolder" />
        </AppActionButton>
      </template>
      <AppTree
        ref="treeRef"
        v-model="folderStore.foldersTree"
        :selected-id="folderStore.selectedId"
        :context-menu-handler="contextMenuHandler"
        :focus-handler="focusHandler"
        @update:model-value="onUpdate"
        @click:node="onClickFolder"
      >
        <template #default="{ node }">
          <SidebarListItem
            :id="node.id"
            :data-id="node.id"
            :is-folder="true"
            :model="node"
            @drop="onDrop($event, node.id)"
            @dragover.prevent
            @dragenter="onDragEnter(node.id)"
          >
            <TheFolder
              :id="node.id"
              :name="node.name"
            />
          </SidebarListItem>
        </template>
      </AppTree>
    </SidebarList>
    <div
      ref="gutterRef"
      class="gutter-line"
    />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'
import { onMounted, ref, watch } from 'vue'
import type {
  SidebarSystemFolder,
  SystemFolderAlias,
  Tab,
  Tabs
} from '@shared/types/renderer/sidebar'
import Inbox from '~icons/unicons/inbox'
import Favorite from '~icons/unicons/favorite'
import Archive from '~icons/unicons/archive'
import Trash from '~icons/unicons/trash'
import LabelAlt from '~icons/unicons/label-alt'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { ipc, store, i18n } from '@/electron'
import { useTagStore } from '@/store/tags'
import { emitter, onAddNewFolder } from '@/composable'
import interact from 'interactjs'
import { useAppStore } from '@/store/app'
import type { Snippet } from '@shared/types/main/db'
import { onScrollToFolder } from './composable'

const folderStore = useFolderStore()
const snippetStore = useSnippetStore()
const tagStore = useTagStore()
const appStore = useAppStore()

const treeRef = ref()
const sidebarRef = ref()
const gutterRef = ref()

const systemFolders: SidebarSystemFolder[] = [
  { name: i18n.t('sidebar.inbox'), alias: 'inbox', icon: Inbox },
  { name: i18n.t('sidebar.favorites'), alias: 'favorites', icon: Favorite },
  { name: i18n.t('sidebar.allSnippets'), alias: 'all', icon: Archive },
  { name: i18n.t('sidebar.trash'), alias: 'trash', icon: Trash }
]

const tabs: Tabs[] = [
  { label: i18n.t('sidebar.library'), value: 'library' },
  { label: i18n.t('sidebar.tags'), value: 'tags' }
]

const activeTab = ref<Tab>('library')

const onClickFolder = async (id: string) => {
  folderStore.selectId(id)
  await snippetStore.setSnippetsByFolderIds(true)
  snippetStore.searchQuery = undefined
  snippetStore.searchQueryEscaped = undefined
  appStore.addToHistory(snippetStore.snippets[0]?.id)
  emitter.emit('folder:click', id)
}

const onClickSystemFolder = (alias: SystemFolderAlias) => {
  snippetStore.setSnippetsByAlias(alias)
  snippetStore.searchQuery = ''
}

const onClickTag = (id: string) => {
  snippetStore.setSnippetsByTagId(id)
  tagStore.selectedId = id
}

const contextMenuHandler = () => {
  return new Promise<boolean>(resolve => {
    ipc.once('context-menu:close', () => resolve(false))
  })
}

const onUpdate = async () => {
  await folderStore.updateFoldersTable()
}

const onDrop = async (e: DragEvent, id: string) => {
  const payload = e.dataTransfer?.getData('payload')

  if (payload) {
    const snippetIds = JSON.parse(payload)

    for (const i of snippetIds) {
      const isDeleted = snippetStore.snippets.find(s => s.id === i)?.isDeleted

      const body: Partial<Snippet> = {
        folderId: id
      }

      if (isDeleted) body.isDeleted = false

      await snippetStore.patchSnippetsById(i, body)
    }

    if (folderStore.selectedIds) {
      snippetStore.getSnippetsByFolderIds(folderStore.selectedIds)
    }

    if (folderStore.selectedAlias) {
      await snippetStore.setSnippetsByAlias(folderStore.selectedAlias)
    }
  }
}

const onDragEnter = (id: string) => {
  folderStore.hoveredId = id
}

const focusHandler = (isFocused: Ref) => {
  onScrollToFolder(isFocused)
}

onMounted(() => {
  interact(sidebarRef.value).resizable({
    allowFrom: gutterRef.value,
    onmove: e => {
      const { pageX } = e
      const minWidth = 100

      if (pageX < minWidth) return
      const width = Math.floor(pageX)
      appStore.sizes.sidebar = width
      store.app.set('sidebarWidth', width)
    }
  })
})

watch(
  () => folderStore.hoveredId,
  v => {
    if (treeRef.value) {
      treeRef.value.setHoveredNodeId(v)
    }
  }
)

watch(
  () => activeTab.value,
  async v => {
    if (v === 'library') {
      if (folderStore.selectedAlias) {
        snippetStore.setSnippetsByAlias(folderStore.selectedAlias)
      } else {
        await snippetStore.setSnippetsByFolderIds(true)
        return
      }
    }

    if (v === 'tags' && tagStore.selectedId) {
      snippetStore.setSnippetsByTagId(tagStore.selectedId)
    } else {
      snippetStore.selected = undefined
      snippetStore.snippets = []
      snippetStore.selectedMultiple = []
    }
  }
)
</script>

<style lang="scss" scoped>
.sidebar {
  padding-top: var(--title-bar-height);
  position: relative;
  background-color: var(--color-sidebar);
  display: flex;
  flex-flow: column;
  height: 100%;
  overflow: hidden;
  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 var(--spacing-xs);
  }
}
</style>
