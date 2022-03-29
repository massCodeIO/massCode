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
import type { FunctionalComponent } from 'vue'
import { computed, ref } from 'vue'
import type { Tab, Tabs } from './types'
import Inbox from '~icons/unicons/inbox'
import Favorite from '~icons/unicons/favorite'
import Archive from '~icons/unicons/archive'
import Trash from '~icons/unicons/trash'
import { useFolderStore } from '@/store/folders'
import type { Folder } from '@@/types/db'
import { useSnippetStore } from '@/store/snippets'

interface SidebarSystemFolder extends Folder {
  icon: FunctionalComponent
}

const folderStore = useFolderStore()
const snippetStore = useSnippetStore()

const systemFolders = computed(() => {
  const folders = folderStore.system.map<Partial<SidebarSystemFolder>>(i => {
    let icon
    if (i.name === 'Inbox') icon = Inbox
    if (i.name === 'Trash') icon = Trash
    return { ...i, icon }
  })

  const favAndAll = [
    { name: 'Favorites', icon: Favorite },
    { name: 'All Snippets', icon: Archive }
  ]

  folders.splice(1, 0, ...favAndAll)

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
  const firstSnippetId = snippetStore.snippets[0]?.id
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
