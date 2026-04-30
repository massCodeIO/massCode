<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useHttpApp, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const searchQuery = defineModel<string>('searchQuery', { required: true })

const { httpState } = useHttpApp()
const { createHttpRequestAndSelect } = useHttpRequests()

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
    <div class="flex items-center px-1">
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
      <UiActionButton
        :tooltip="i18n.t('spaces.http.action.newRequest')"
        @click="onCreateRequest"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
