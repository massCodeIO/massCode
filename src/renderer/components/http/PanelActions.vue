<script setup lang="ts">
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { i18n } from '@/electron'

const { isHttpSidebarHidden, httpState } = useHttpApp()
const { inspectorOpen, bottomOpen } = useHttpPanels()
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
      :aria-pressed="inspectorOpen"
      @click="inspectorOpen = !inspectorOpen"
    >
      <UiPanelIcon
        side="right"
        :open="inspectorOpen"
        class="size-4"
      />
    </UiActionButton>
  </div>
</template>
