<script setup lang="ts">
import { useHttpApp, useHttpRequests, useHttpSearch } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, Star, X } from 'lucide-vue-next'

const favorites = defineModel<boolean>('favorites', { default: false })
const { httpState, isFocusedSearch } = useHttpApp()
const { createHttpRequestAndSelect } = useHttpRequests()
const { searchQuery } = useHttpSearch()
</script>

<template>
  <div class="flex h-9 shrink-0 items-center gap-0.5 border-b px-1">
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
    <UiActionButton
      :tooltip="i18n.t('spaces.http.action.newRequest')"
      @click="
        createHttpRequestAndSelect({ folderId: httpState.folderId ?? null })
      "
    >
      <Plus class="size-4" />
    </UiActionButton>
    <slot name="actions" />
  </div>
</template>
