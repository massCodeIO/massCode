<script setup lang="ts">
import { useHttpApp, useHttpFolders, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { Plus } from 'lucide-vue-next'

const { httpState } = useHttpApp()
const { folders } = useHttpFolders()
const { createHttpRequestAndSelect } = useHttpRequests()

const currentFolder = computed(() =>
  httpState.folderId
    ? folders.value.find(f => f.id === httpState.folderId)
    : null,
)

const title = computed(() =>
  currentFolder.value
    ? currentFolder.value.name
    : i18n.t('spaces.http.allRequests'),
)

async function onCreateRequest() {
  await createHttpRequestAndSelect({
    folderId: httpState.folderId ?? null,
  })
}
</script>

<template>
  <div class="border-border mt-[var(--content-top-offset)] mb-2 border-b pb-1">
    <div class="flex items-center px-2">
      <UiText class="flex-grow truncate font-bold">
        {{ title }}
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('spaces.http.action.newRequest')"
        @click="onCreateRequest"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
