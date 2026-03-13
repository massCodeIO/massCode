<script setup lang="ts">
import { i18n } from '@/electron'
</script>

<template>
  <div
    data-sidebar
    class="flex h-full flex-col px-1 pt-[var(--content-top-offset)]"
  >
    <div class="truncate px-1 pb-2 font-bold select-none">
      {{ i18n.t("sidebar.title") }}
    </div>
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
      class="flex gap-1 pb-1 pl-1 select-none"
    >
      {{ i18n.t("sidebar.library") }}
    </UiText>
    <SidebarLibrary />
  </div>
</template>
