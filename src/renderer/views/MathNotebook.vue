<script setup lang="ts">
import { useApp, useMathNotebook } from '@/composables'
import { i18n } from '@/electron'
import { Plus } from 'lucide-vue-next'

const { isAppLoading } = useApp()
const { init } = useMathNotebook()
const sheetListRef = ref<{ handleCreateSheet: () => void } | null>(null)

onMounted(async () => {
  await init()
  isAppLoading.value = false
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('spaces.math.title')"
    :show-back="false"
  >
    <template #leftHeader>
      <div class="px-1 pt-[var(--content-top-offset)]">
        <SidebarHeader
          :title="i18n.t('spaces.math.title')"
          :section-title="i18n.t('spaces.math.sheetList')"
        >
          <template #action>
            <UiActionButton
              :tooltip="i18n.t('spaces.math.newSheet')"
              @click="sheetListRef?.handleCreateSheet()"
            >
              <Plus class="h-4 w-4" />
            </UiActionButton>
          </template>
        </SidebarHeader>
      </div>
    </template>
    <template #left>
      <MathNotebookSheetList ref="sheetListRef" />
    </template>
    <template #right>
      <MathNotebookWorkspace />
    </template>
  </LayoutTwoColumn>
</template>
