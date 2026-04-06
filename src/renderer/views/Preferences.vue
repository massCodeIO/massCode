<script setup lang="ts">
import type { Component } from 'vue'
import { preferencesKeys } from '@/components/preferences/keys'
import { i18n, store } from '@/electron'
import { router, RouterName } from '@/router'
import { getSpaceDefinitions } from '@/spaceDefinitions'
import { isMac } from '@/utils'
import {
  Calculator,
  Code2,
  Globe,
  HardDrive,
  Notebook,
  Palette,
  Plug,
} from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const scrollRef = useTemplateRef<HTMLElement>('scrollRef')

const isActiveRoute = computed(() => {
  return (name: string) => route.name === name
})

const nav: { label: string, name: string, icon: Component }[] = [
  {
    label: i18n.t('preferences:storage.label'),
    name: RouterName.preferencesStorage,
    icon: HardDrive,
  },
  {
    label: i18n.t('preferences:editor.label'),
    name: RouterName.preferencesEditor,
    icon: Code2,
  },
  {
    label: i18n.t('preferences:notesEditor.label'),
    name: RouterName.preferencesNotesEditor,
    icon: Notebook,
  },
  {
    label: i18n.t('preferences:math.label'),
    name: RouterName.preferencesMath,
    icon: Calculator,
  },
  {
    label: i18n.t('preferences:language.label'),
    name: RouterName.preferencesLanguage,
    icon: Globe,
  },
  {
    label: i18n.t('preferences:appearance.label'),
    name: RouterName.preferencesAppearance,
    icon: Palette,
  },
  {
    label: i18n.t('preferences:api.label'),
    name: RouterName.preferencesAPI,
    icon: Plug,
  },
]

watch(
  () => route.name,
  (name) => {
    if (name && typeof name === 'string' && name.startsWith('preferences/')) {
      sessionStorage.setItem('preferences:lastRoute', name)
    }
  },
  { immediate: true },
)

provide(preferencesKeys, {
  scrollRef,
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('preferences:label')"
    :top-space="isMac ? 16 : 6"
    @back="
      () => {
        const savedSpace = getSpaceDefinitions().find(
          (s) => s.id === store.app.get('activeSpaceId'),
        );
        router.push(savedSpace?.to ?? { name: RouterName.main });
      }
    "
  >
    <template #left>
      <div class="scrollbar h-full min-h-0 overflow-y-auto px-2">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          class="cursor-default"
          :to="{ name: item.name }"
        >
          <UiMenuItem
            :label="item.label"
            :is-active="isActiveRoute(item.name)"
          >
            <template #icon>
              <component
                :is="item.icon"
                class="h-4 w-4"
              />
            </template>
          </UiMenuItem>
        </RouterLink>
      </div>
    </template>
    <template #right>
      <div
        ref="scrollRef"
        class="scrollbar h-full min-h-0 overflow-y-auto px-5 pt-3 pb-5"
      >
        <RouterView />
      </div>
    </template>
  </LayoutTwoColumn>
</template>
