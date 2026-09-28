<script setup lang="ts">
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { useSpacePanels } from '@/composables/useSpacePanels'
import { i18n } from '@/electron'

const { isHttpSidebarHidden, httpState } = useHttpApp()
const { bottomOpen } = useHttpPanels()
const { secondaryOpen: shown, toggleSecondary: toggleInspector }
  = useSpacePanels()
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5">
    <UiActionButton
      :tooltip="i18n.t('spaces.http.inspector.sidebar')"
      shortcut="CommandOrControl+B"
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
      :tooltip="
        i18n.t(
          shown ? 'action.hideSecondarySidebar' : 'action.showSecondarySidebar',
        )
      "
      shortcut="Alt+CommandOrControl+B"
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
