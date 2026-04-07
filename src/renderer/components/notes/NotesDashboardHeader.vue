<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { useNotesDashboard } from '@/composables'
import { i18n } from '@/electron'
import { ChartNetwork, Settings2 } from 'lucide-vue-next'

const { navigateToGraph } = useNotesDashboard()
</script>

<template>
  <UiPageHeader
    :title="i18n.t('notes.dashboard.title')"
    :description="i18n.t('notes.dashboard.description')"
  >
    <template #actions>
      <Button
        variant="outline"
        @click="navigateToGraph"
      >
        <ChartNetwork />
        {{ i18n.t("notes.dashboard.actions.openGraph") }}
      </Button>
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
