<template>
  <div class="sidebar">
    <SidebarList
      v-model="activeTab"
      :tabs="tabs"
    >
      <template v-if="activeTab === 'library'">
        <SidebarListItem
          v-for="i in demoSystemFolders"
          :key="i.label"
          :icon="i.icon"
          :system="true"
        >
          {{ i.label }}
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
      <SidebarListItem> Demo folder </SidebarListItem>
    </SidebarList>
    <div
      ref="gutter"
      class="gutter-line"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Tab, Tabs } from './types'
import Inbox from '~icons/unicons/inbox'
import Favorite from '~icons/unicons/favorite'
import Archive from '~icons/unicons/archive'
import Trash from '~icons/unicons/trash'

const demoSystemFolders = [
  { label: 'Inbox', id: 'inbox', icon: Inbox },
  { label: 'Favorites', id: 'favorites', icon: Favorite },
  { label: 'All snippets', id: 'all', icon: Archive },
  { label: 'Trash', id: 'trash', icon: Trash }
]

const tabs: Tabs[] = [
  { label: 'Library', value: 'library' },
  { label: 'Tabs', value: 'tags' }
]
const activeTab = ref<Tab>('library')
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
