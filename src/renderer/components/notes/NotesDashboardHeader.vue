<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { useNotesDashboard } from '@/composables'
import { i18n } from '@/electron'
import { ChartNetwork, RefreshCw, Settings2 } from 'lucide-vue-next'

const { getNotesDashboard, navigateToGraph } = useNotesDashboard()
</script>

<template>
  <div
    class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
  >
    <div>
      <h1 class="text-xl font-semibold">
        {{ i18n.t("notes.dashboard.title") }}
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ i18n.t("notes.dashboard.description") }}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        @click="getNotesDashboard"
      >
        <RefreshCw class="mr-2 h-4 w-4" />
        {{ i18n.t("notes.dashboard.actions.refresh") }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        @click="navigateToGraph"
      >
        <ChartNetwork class="mr-2 h-4 w-4" />
        {{ i18n.t("notes.dashboard.actions.openGraph") }}
      </Button>
      <Popover.Popover>
        <Popover.PopoverTrigger as-child>
          <Button
            size="icon"
            variant="outline"
          >
            <Settings2 class="h-4 w-4" />
          </Button>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent class="w-80 p-0">
          <NotesDashboardSettings />
        </Popover.PopoverContent>
      </Popover.Popover>
    </div>
  </div>
</template>
