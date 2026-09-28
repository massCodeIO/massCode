<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { HelpCircle } from 'lucide-vue-next'

defineProps<{ label: string }>()
const titleId = useId()
</script>

<template>
  <Popover.Popover>
    <Popover.PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="text-muted-foreground size-7 shrink-0 rounded-full"
        :aria-label="label"
      >
        <HelpCircle
          class="size-4"
          aria-hidden="true"
        />
      </Button>
    </Popover.PopoverTrigger>
    <Popover.PopoverContent
      align="end"
      class="scrollbar max-h-[var(--reka-popover-content-available-height)] w-96 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <UiText
        :id="titleId"
        as="div"
        variant="sm"
        weight="medium"
      >
        {{ label }}
      </UiText>
      <slot />
    </Popover.PopoverContent>
  </Popover.Popover>
</template>
