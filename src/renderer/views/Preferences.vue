<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

function isActiveRoute(name: string): boolean {
  return route.name === name
}

const nav = [
  {
    label: 'Storage',
    name: 'preferences/storage',
    isActive: isActiveRoute('preferences/storage'),
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
            :is-active="item.isActive"
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
