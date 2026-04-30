<script setup lang="ts">
import { useApp, useHttpSpaceInit } from '@/composables'

const { isAppLoading } = useApp()
const { initHttpSpace } = useHttpSpaceInit()

void initHttpSpace()

onMounted(() => {
  isAppLoading.value = false
})
</script>

<template>
  <LayoutThreeColumn
    :show-sidebar="true"
    :show-list="true"
  >
    <template #sidebar>
      <HttpSidebar />
    </template>
    <template #list>
      <RequestsList />
    </template>
    <template #editor>
      <RequestEditorPane />
    </template>
  </LayoutThreeColumn>
</template>
