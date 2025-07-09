<script setup lang="ts">
import type { PerfectScrollbarExpose } from 'vue3-perfect-scrollbar'
import { preferencesKeys } from '@/components/preferences/keys'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const scrollRef = useTemplateRef<PerfectScrollbarExpose>('scrollRef')

const isActiveRoute = computed(() => {
  return (name: string) => route.name === name
})

const nav = [
  {
    label: i18n.t('preferences:storage.label'),
    name: RouterName.preferencesStorage,
  },
  {
    label: i18n.t('preferences:editor.label'),
    name: RouterName.preferencesEditor,
  },
  {
    label: i18n.t('preferences:language.label'),
    name: RouterName.preferencesLanguage,
  },
  {
    label: i18n.t('preferences:appearance.label'),
    name: RouterName.preferencesAppearance,
  },
]

provide(preferencesKeys, {
  scrollRef,
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('preferences:label')"
    @back="() => router.push({ name: RouterName.main })"
  >
    <template #left>
      <PerfectScrollbar
        class="h-full px-2"
        :options="{ minScrollbarLength: 20 }"
      >
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          class="cursor-default"
          :to="{ name: item.name }"
        >
          <UiMenuItem
            :label="item.label"
            :is-active="isActiveRoute(item.name)"
          />
        </RouterLink>
      </PerfectScrollbar>
    </template>
    <template #right>
      <PerfectScrollbar
        ref="scrollRef"
        class="h-full px-5 pb-5"
        :options="{ minScrollbarLength: 20 }"
      >
        <RouterView />
      </PerfectScrollbar>
    </template>
  </LayoutTwoColumn>
</template>
