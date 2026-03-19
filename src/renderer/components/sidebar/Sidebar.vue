<script setup lang="ts">
import { i18n } from '@/electron'
</script>

<template>
  <div
    data-sidebar
    class="flex h-full flex-col px-1 pt-[var(--content-top-offset)]"
  >
    <SidebarHeader :title="i18n.t('sidebar.title')" />
    <SidebarLibrary />
  </div>
</template>
