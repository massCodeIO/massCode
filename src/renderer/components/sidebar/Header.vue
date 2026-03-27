<script setup lang="ts">
import { i18n } from '@/electron'

interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="px-1">
    <div class="truncate px-1 pb-2 leading-5 font-bold select-none">
      {{ title }}
    </div>
    <SidebarSectionHeader :title="i18n.t('common.library')" />
  </div>
</template>
