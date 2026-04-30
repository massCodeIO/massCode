<script setup lang="ts">
import { useHttpFolders } from '@/composables'
import { i18n } from '@/electron'
import { Plus } from 'lucide-vue-next'

const { createHttpFolderAndSelect, folderTree } = useHttpFolders()
</script>

<template>
  <div
    class="flex h-full flex-col px-1"
    style="
      padding-top: calc(var(--content-top-offset) + var(--header-gap, 0px));
    "
  >
    <SidebarHeader
      :title="i18n.t('spaces.http.title')"
      :section-title="i18n.t('common.folders')"
    >
      <template #action>
        <UiActionButton
          :tooltip="i18n.t('action.new.folder')"
          @click="createHttpFolderAndSelect()"
        >
          <Plus class="h-4 w-4" />
        </UiActionButton>
      </template>
    </SidebarHeader>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <UiEmptyPlaceholder
        v-if="folderTree.length === 0"
        :text="i18n.t('placeholder.emptyFoldersList')"
      />
      <HttpSidebarFolderItem
        v-for="folder in folderTree"
        v-else
        :key="folder.id"
        :folder="folder"
        :depth="0"
      />
    </div>
  </div>
</template>
