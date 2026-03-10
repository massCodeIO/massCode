<script setup lang="ts">
import { useApp } from '@/composables'
import { i18n } from '@/electron'

const { isAppLoading } = useApp()

onMounted(() => {
  isAppLoading.value = false
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('mathNotebook.label')"
    :show-back="false"
  >
    <template #left>
      <MathNotebookSheetList />
    </template>
    <template #right>
      <MathNotebookWorkspace />
    </template>
  </LayoutTwoColumn>
</template>
