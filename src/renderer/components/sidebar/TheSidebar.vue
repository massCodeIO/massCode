<template>
  <div class="sidebar">
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
          :system="true"
          :is-selected="i.alias === folderStore.selectedAlias"
          @click="onClickSystemFolder(i.alias)"
        >
          {{ i.name }}
        </SidebarListItem>
      </template>
      <template v-if="activeTab === 'tags'">
        tags
      </template>
    </SidebarList>
    <SidebarList
      v-if="activeTab === 'library'"
      title="Folders"
    >
      <template #action>
        <UniconsPlus @click="onAddNewFolder" />
      </template>
      <AppTree
        ref="treeRef"
        v-model="folderStore.foldersTree"
        :selected-id="folderStore.selectedId"
        :context-menu-handler="contextMenuHandler"
        @update:model-value="onUpdate"
        @click:node="onClickFolder"
      >
        <template #default="{ node }">
          <SidebarListItem
            :id="node.id"
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
      ref="gutter"
      class="gutter-line"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { ipc } from '@/electron'

const folderStore = useFolderStore()
const snippetStore = useSnippetStore()

const treeRef = ref()

const onDrop = async (e: DragEvent, id: string) => {
  const payload = e.dataTransfer?.getData('payload')

  if (payload) {
    const snippetIds = JSON.parse(payload)
    for (const i of snippetIds) {
      await snippetStore.patchSnippetsById(i, {
        folderId: id
      })
    }
    snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  }
}

const onDragEnter = (id: string) => {
  folderStore.hoveredId = id
}

watch(
  () => folderStore.hoveredId,
  () => {
    if (treeRef.value) {
      treeRef.value.setHoveredNodeId(folderStore.hoveredId)
    }
  }
)

const systemFolders = computed(() => {
  const folders = folderStore.system.map(i => {
    let icon
    let alias
    if (i.name === 'Inbox') {
      icon = Inbox
      alias = 'inbox'
    }
    return { ...i, alias, icon }
  }) as SidebarSystemFolder[]

  const other: SidebarSystemFolder[] = [
    { name: 'Favorites', alias: 'favorites', icon: Favorite },
    { name: 'All Snippets', alias: 'all', icon: Archive },
    { name: 'Trash', alias: 'trash', icon: Trash }
  ]

  folders.splice(1, 0, ...other)

  return folders
})

const tabs: Tabs[] = [
  { label: 'Library', value: 'library' },
  { label: 'Tabs', value: 'tags' }
]

const activeTab = ref<Tab>('library')

const onClickFolder = async (id: string) => {
  folderStore.selectId(id)
  await snippetStore.setSnippetsByFolderIds(true)
}

const onClickSystemFolder = (alias: SystemFolderAlias) => {
  snippetStore.setSnippetsByAlias(alias)
}

const contextMenuHandler = () => {
  return new Promise<boolean>(resolve => {
    ipc.once('context-menu:close', () => resolve(false))
  })
}

const onAddNewFolder = async () => {
  await folderStore.addNewFolder()
}

const onUpdate = async () => {
  await folderStore.updateFoldersTable()
}
</script>

<style lang="scss" scoped>
.sidebar {
  padding-top: var(--title-bar-height);
  position: relative;
  background-color: var(--color-contrast-lower);
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
