<script setup lang="ts">
import { useAi } from '@/composables/ai/useAi'
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { i18n } from '@/electron'

const { isHttpSidebarHidden, httpState } = useHttpApp()
const { inspectorOpen, bottomOpen } = useHttpPanels()
const { open: aiOpen, setOpen: setAiOpen } = useAi()
const shown = computed(() => inspectorOpen.value || aiOpen.value)
function toggleInspector() {
  const next = !shown.value
  setAiOpen(false)
  inspectorOpen.value = next
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5">
    <UiActionButton
      :tooltip="i18n.t('spaces.http.inspector.sidebar')"
      :aria-pressed="!isHttpSidebarHidden"
      @click="isHttpSidebarHidden = !isHttpSidebarHidden"
    >
      <UiPanelIcon
        side="left"
        :open="!isHttpSidebarHidden"
        class="size-4"
      />
    </UiActionButton>
    <UiActionButton
      v-if="!httpState.activePanel || httpState.activePanel === 'request'"
      :tooltip="i18n.t('spaces.http.inspector.bottom')"
      :aria-pressed="bottomOpen"
      @click="bottomOpen = !bottomOpen"
    >
      <UiPanelIcon
        side="bottom"
        :open="bottomOpen"
        class="size-4"
      />
    </UiActionButton>
    <UiActionButton
      :tooltip="i18n.t('spaces.http.runtime.variablesInspector')"
      :aria-pressed="shown"
      @click="toggleInspector"
    >
      <UiPanelIcon
        side="right"
        :open="shown"
        class="size-4"
      />
    </UiActionButton>
  </div>
</template>
