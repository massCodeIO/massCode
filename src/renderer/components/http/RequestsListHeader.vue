<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { Separator } from '@/components/ui/shadcn/separator'
import {
  useHttpApp,
  useHttpFolders,
  useHttpImportDialog,
  useHttpRequests,
  useHttpSearch,
} from '@/composables'
import { i18n } from '@/electron'
import { Layers, Plus, Search, Send, Star, Upload, X } from 'lucide-vue-next'

const favorites = defineModel<boolean>('favorites', { default: false })
const { httpState, isFocusedSearch } = useHttpApp()
const { createHttpRequestAndSelect } = useHttpRequests()
const { searchQuery } = useHttpSearch()
const { createHttpFolderAndSelect } = useHttpFolders()
const isCreateMenuOpen = ref(false)
const { openHttpImportDialog } = useHttpImportDialog()

function openImport() {
  isCreateMenuOpen.value = false
  openHttpImportDialog()
}

async function create(kind: 'collection' | 'request') {
  isCreateMenuOpen.value = false
  if (kind === 'collection')
    await createHttpFolderAndSelect()
  else
    await createHttpRequestAndSelect({ folderId: httpState.folderId ?? null })
}
</script>

<template>
  <div
    class="flex h-[calc(40px-var(--content-top-offset))] shrink-0 items-center gap-0.5 border-b px-1 pb-1"
  >
    <Search class="text-muted-foreground ml-1 size-4 shrink-0" />
    <UiInput
      v-model="searchQuery"
      :placeholder="i18n.t('placeholder.search')"
      variant="ghost"
      class="min-w-0 flex-1 truncate"
      :focus="isFocusedSearch"
      @blur="isFocusedSearch = false"
      @keydown.esc="searchQuery = ''"
    />
    <UiActionButton
      v-if="searchQuery"
      :tooltip="i18n.t('action.clearSearch')"
      @click="searchQuery = ''"
    >
      <X class="size-4" />
    </UiActionButton>
    <UiActionButton
      :tooltip="i18n.t('common.favorites')"
      :aria-pressed="favorites"
      :class="{ 'bg-accent text-primary': favorites }"
      @click="favorites = !favorites"
    >
      <Star
        class="size-4"
        :class="{ 'fill-current': favorites }"
      />
    </UiActionButton>
    <Popover.Popover v-model:open="isCreateMenuOpen">
      <Popover.PopoverTrigger as-child>
        <UiActionButton :tooltip="i18n.t('action.createOptions')">
          <Plus class="size-4" />
        </UiActionButton>
      </Popover.PopoverTrigger>
      <Popover.PopoverContent
        align="end"
        class="flex w-max flex-col p-1"
        @close-auto-focus="(event) => event.preventDefault()"
      >
        <Button
          variant="ghost"
          size="sm"
          class="justify-start"
          @click="create('collection')"
        >
          <Layers class="size-4" />
          <UiText
            variant="base"
            weight="medium"
            class="leading-5 text-inherit"
          >
            {{ i18n.t("spaces.http.tree.newCollection") }}
          </UiText>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="justify-start"
          @click="create('request')"
        >
          <Send class="size-4" />
          <UiText
            variant="base"
            weight="medium"
            class="leading-5 text-inherit"
          >
            {{ i18n.t("spaces.http.action.newRequest") }}
          </UiText>
        </Button>
        <Separator class="my-1" />
        <Button
          variant="ghost"
          size="sm"
          class="justify-start"
          @click="openImport"
        >
          <Upload class="size-4" />
          <UiText
            variant="base"
            weight="medium"
            class="leading-5 text-inherit"
          >
            {{ i18n.t("spaces.http.action.import") }}
          </UiText>
        </Button>
      </Popover.PopoverContent>
    </Popover.Popover>
  </div>
</template>
