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
        <UniconsPlus />
      </template>
      <AppTree
        v-model="folderStore.foldersTree"
        :selected-id="folderStore.selectedId"
        @update:model-value="onUpdate"
        @click:node="onClickFolder"
      >
        <template #default="{ node }">
          <SidebarListItem>
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
import { computed, ref } from 'vue'
import type { SidebarSystemFolder, Tab, Tabs } from './types'
import Inbox from '~icons/unicons/inbox'
import Favorite from '~icons/unicons/favorite'
import Archive from '~icons/unicons/archive'
import Trash from '~icons/unicons/trash'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'

const folderStore = useFolderStore()
const snippetStore = useSnippetStore()

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
  await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds as string[])
  const firstSnippetId = snippetStore.snippetsNonDeleted[0]?.id
  snippetStore.getSnippetsById(firstSnippetId)
}

const onUpdate = () => {
  folderStore.updateSort()
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
