<script setup lang="ts">
import { useApp, useMathNotebook } from '@/composables'
import { i18n } from '@/electron'

const { isAppLoading } = useApp()
const { init } = useMathNotebook()

onMounted(async () => {
  await init()
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
