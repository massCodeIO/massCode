<script setup lang="ts">
import { i18n } from '@/electron'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const isActiveRoute = computed(() => {
  return (name: string) => route.name === name
})

const nav = [
  {
    label: i18n.t('preferences:storage.label'),
    name: 'preferences/storage',
  },
  {
    label: i18n.t('preferences:language.label'),
    name: 'preferences/language',
  },
  {
    label: i18n.t('preferences:appearance.label'),
    name: 'preferences/appearance',
  },
]
</script>

<template>
  <LayoutTwoColumn
    title="Preferences"
    @back="() => router.push({ name: 'main' })"
  >
    <template #left>
      <PerfectScrollbar class="h-full px-2">
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
      <PerfectScrollbar class="h-full px-5">
        <RouterView />
      </PerfectScrollbar>
    </template>
  </LayoutTwoColumn>
</template>
