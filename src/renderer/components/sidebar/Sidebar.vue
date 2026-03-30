<script setup lang="ts">
import { i18n } from '@/electron'
</script>

<template>
  <div
    data-sidebar
    class="flex h-full flex-col px-1"
    style="
      padding-top: calc(var(--content-top-offset) + var(--header-gap, 0px));
    "
  >
    <SidebarHeader
      :title="i18n.t('spaces.code.title')"
      :section-title="i18n.t('common.library')"
    />
    <SidebarLibrary />
  </div>
</template>
