<script setup lang="ts">
import { useApp, useDrawings } from '@/composables'
import { i18n } from '@/electron'
import { Plus } from 'lucide-vue-next'

const { isAppLoading } = useApp()
const { init } = useDrawings()
const drawingListRef = ref<{ handleCreateDrawing: () => void } | null>(null)

onMounted(async () => {
  await init()
  isAppLoading.value = false
})
</script>

<template>
  <LayoutTwoColumn
    :title="i18n.t('spaces.drawings.title')"
    :show-back="false"
  >
    <template #leftHeader>
      <div class="px-1 pt-[var(--content-top-offset)]">
        <SidebarHeader
          :title="i18n.t('spaces.drawings.title')"
          :section-title="i18n.t('spaces.drawings.drawingList')"
        >
          <template #action>
            <UiActionButton
              :tooltip="i18n.t('spaces.drawings.newDrawing')"
              @click="drawingListRef?.handleCreateDrawing()"
            >
              <Plus class="h-4 w-4" />
            </UiActionButton>
          </template>
        </SidebarHeader>
      </div>
    </template>
    <template #left>
      <DrawingsList ref="drawingListRef" />
    </template>
    <template #right>
      <DrawingsWorkspace />
    </template>
  </LayoutTwoColumn>
</template>
