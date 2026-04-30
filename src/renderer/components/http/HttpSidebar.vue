<script setup lang="ts">
import { useHttpFolders, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { FolderPlus, Plus } from 'lucide-vue-next'

const { createHttpFolderAndSelect, folderTree } = useHttpFolders()
const { createHttpRequestAndSelect, requests } = useHttpRequests()

const rootRequests = computed(() =>
  requests.value.filter(r => r.folderId === null),
)

const isEmpty = computed(
  () => folderTree.value.length === 0 && rootRequests.value.length === 0,
)

async function onCreateRootFolder() {
  await createHttpFolderAndSelect()
}

async function onCreateRootRequest() {
  await createHttpRequestAndSelect({ folderId: null })
}
</script>

<template>
  <div class="bg-sidebar flex h-full flex-col overflow-hidden">
    <div
      class="border-border flex h-9 shrink-0 items-center justify-between border-b px-3"
    >
      <UiText class="text-muted-foreground text-xs uppercase">
        {{ i18n.t("spaces.http.title") }}
      </UiText>
      <div class="flex items-center gap-1">
        <UiActionButton
          :tooltip="i18n.t('spaces.http.action.newRequest')"
          @click="onCreateRootRequest"
        >
          <Plus class="h-4 w-4" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('action.new.folder')"
          @click="onCreateRootFolder"
        >
          <FolderPlus class="h-4 w-4" />
        </UiActionButton>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      <UiEmptyPlaceholder
        v-if="isEmpty"
        :text="i18n.t('spaces.http.empty')"
      />
      <template v-else>
        <HttpSidebarFolderItem
          v-for="folder in folderTree"
          :key="folder.id"
          :folder="folder"
          :depth="0"
        />
        <HttpSidebarRequestItem
          v-for="request in rootRequests"
          :key="request.id"
          :request="request"
          :depth="0"
        />
      </template>
    </div>
  </div>
</template>
