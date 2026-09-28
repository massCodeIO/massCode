<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useNavigationHistory } from '@/composables'
import { i18n } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-vue-next'

const { canGoBack, canGoForward } = useNavigationHistory()

const isHistoryVisible = computed(() => canGoBack.value || canGoForward.value)

function onBackClick() {
  void navigateBack()
}

function onForwardClick() {
  void navigateForward()
}
</script>

<template>
  <UiPageHeader
    :title="i18n.t('notes.dashboard.title')"
    :description="i18n.t('notes.dashboard.description')"
  >
    <template #actions>
      <div
        v-if="isHistoryVisible"
        class="flex items-center gap-1"
      >
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <Button
              size="icon"
              variant="outline"
              :disabled="!canGoBack"
              @click="onBackClick"
            >
              <ChevronLeft />
            </Button>
          </Tooltip.TooltipTrigger>
          <Tooltip.TooltipContent>
            {{ i18n.t("menu:history.back") }}
          </Tooltip.TooltipContent>
        </Tooltip.Tooltip>
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <Button
              size="icon"
              variant="outline"
              :disabled="!canGoForward"
              @click="onForwardClick"
            >
              <ChevronRight />
            </Button>
          </Tooltip.TooltipTrigger>
          <Tooltip.TooltipContent>
            {{ i18n.t("menu:history.forward") }}
          </Tooltip.TooltipContent>
        </Tooltip.Tooltip>
      </div>
      <Popover.Popover>
        <Popover.PopoverTrigger as-child>
          <Button
            size="icon"
            variant="outline"
          >
            <Settings2 />
          </Button>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent class="w-80 p-0">
          <NotesDashboardSettings />
        </Popover.PopoverContent>
      </Popover.Popover>
    </template>
  </UiPageHeader>
</template>
