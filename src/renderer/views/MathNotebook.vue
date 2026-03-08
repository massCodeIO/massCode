<script setup lang="ts">
import { useApp } from '@/composables'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'

const { isAppLoading } = useApp()

onMounted(() => {
  isAppLoading.value = false
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('mathNotebook.label')"
    @back="() => router.push({ name: RouterName.main })"
  >
    <template #left>
      <MathNotebookSheetList />
    </template>
    <template #right>
      <MathNotebookWorkspace />
    </template>
  </LayoutTwoColumn>
</template>
