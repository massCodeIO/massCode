<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useSemanticIndexing } from '@/composables'
import { semanticIndicatorTooltip } from '@/composables/semantic-indexing/indicator'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { isWindows } from '@/utils'
import { ScanSearch } from 'lucide-vue-next'

const { isVisible, percent, phase, status } = useSemanticIndexing()

const tooltip = computed(() =>
  status.value
    ? semanticIndicatorTooltip(
        status.value,
        phase.value,
        (key, options) => i18n.t(key, options),
        isWindows,
      )
    : '',
)

function openSettings() {
  router.push({ name: RouterName.preferencesSemanticSearch })
}
</script>

<template>
  <Tooltip.Tooltip v-if="isVisible">
    <Tooltip.TooltipTrigger as-child>
      <button
        type="button"
        class="text-muted-foreground hover:bg-accent-hover flex w-full cursor-default flex-col items-center gap-1 rounded-md px-2 py-1"
        :aria-label="i18n.t('ai.semantic.title')"
        @click="openSettings"
      >
        <ScanSearch
          class="h-4 w-4 shrink-0"
          :class="phase === 'error' ? 'text-destructive' : 'animate-pulse'"
        />
        <UiText
          v-if="phase !== 'error' && percent !== undefined"
          variant="caption"
          weight="medium"
          class="leading-none select-none"
        >
          {{ percent }}%
        </UiText>
      </button>
    </Tooltip.TooltipTrigger>
    <Tooltip.TooltipContent
      side="right"
      class="whitespace-pre-line"
    >
      {{ tooltip }}
    </Tooltip.TooltipContent>
  </Tooltip.Tooltip>
</template>
