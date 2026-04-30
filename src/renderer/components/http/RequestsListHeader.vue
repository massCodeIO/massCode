<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useHttpApp, useHttpFolders, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const searchQuery = defineModel<string>('searchQuery', { required: true })

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

function clearSearch() {
  searchQuery.value = ''
}
</script>

<template>
  <div class="border-border mt-[var(--content-top-offset)] mb-2 border-b pb-1">
    <div class="flex items-center gap-1 px-2">
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
    <div class="mt-1 flex items-center px-1">
      <Search class="text-muted-foreground ml-1 h-4 w-4" />
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('placeholder.search')"
          variant="ghost"
        />
      </div>
      <Button
        v-if="searchQuery"
        variant="ghost"
        @click="clearSearch"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>
