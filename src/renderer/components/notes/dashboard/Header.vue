<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { i18n } from '@/electron'
import { Settings2 } from 'lucide-vue-next'
</script>

<template>
  <UiPageHeader
    :title="i18n.t('notes.dashboard.title')"
    :description="i18n.t('notes.dashboard.description')"
  >
    <template #actions>
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
