<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useCloudDownloads } from '@/composables'
import { i18n } from '@/electron'
import { CloudAlert, CloudDownload } from 'lucide-vue-next'

const { hasFailed, isDownloading, isVisible, pendingCount, status }
  = useCloudDownloads()

const tooltip = computed(() => {
  const lines: string[] = []

  if (isDownloading.value) {
    lines.push(
      i18n.t('cloudDownloads.downloading', { count: pendingCount.value }),
    )
  }

  if (hasFailed.value) {
    lines.push(i18n.t('cloudDownloads.failed', { count: status.value.failed }))
  }

  return lines.join('\n')
})
</script>

<template>
  <Tooltip.Tooltip v-if="isVisible">
    <Tooltip.TooltipTrigger as-child>
      <div
        class="text-muted-foreground flex w-full cursor-default flex-col items-center gap-1 px-2 py-1"
        :aria-label="i18n.t('cloudDownloads.label')"
      >
        <CloudAlert
          v-if="hasFailed && !isDownloading"
          class="text-destructive h-4 w-4 shrink-0"
        />
        <CloudDownload
          v-else
          class="h-4 w-4 shrink-0 animate-pulse"
        />
        <UiText
          v-if="isDownloading"
          variant="caption"
          weight="medium"
          class="leading-none select-none"
        >
          {{ pendingCount }}
        </UiText>
      </div>
    </Tooltip.TooltipTrigger>
    <Tooltip.TooltipContent
      side="right"
      class="whitespace-pre-line"
    >
      {{ tooltip }}
    </Tooltip.TooltipContent>
  </Tooltip.Tooltip>
</template>
