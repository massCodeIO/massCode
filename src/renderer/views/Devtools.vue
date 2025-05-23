<script setup lang="ts">
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { useRoute } from 'vue-router'

const route = useRoute()

const isActiveRoute = computed(() => {
  return (name: string) => route.name === name
})

const nav = [
  {
    label: i18n.t('devtools:textTools.caseConverter'),
    name: RouterName.devtoolsTextCaseConverter,
  },
]
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('devtools:label')"
    @back="() => router.push({ name: RouterName.main })"
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
      <PerfectScrollbar class="h-full px-5 pb-5">
        <RouterView />
      </PerfectScrollbar>
    </template>
  </LayoutTwoColumn>
</template>
