<script setup lang="ts">
import * as Tabs from '@/components/ui/shadcn/tabs'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'
import { ScanSearch, Sparkles, X } from 'lucide-vue-next'

const emit = defineEmits<{ close: [], inspector: [] }>()
const { open, setOpen } = useAi()
const tab = computed({
  get: () => (open.value ? 'ai' : 'inspector'),
  set: (value: string | number) => {
    if (value === 'inspector')
      emit('inspector')
    setOpen(value === 'ai')
  },
})
</script>

<template>
  <Tabs.Tabs
    v-model="tab"
    class="flex h-full min-h-0 flex-col gap-0 pt-[var(--content-top-offset)]"
  >
    <div
      class="flex h-[calc(41px-var(--content-top-offset))] shrink-0 items-center justify-between gap-1 border-b px-2 pb-1"
    >
      <Tabs.TabsList class="min-w-0 flex-1">
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <Tabs.TabsTrigger
              value="inspector"
              class="min-w-0"
              :aria-label="i18n.t('common.inspector')"
            >
              <ScanSearch
                class="size-4"
                aria-hidden="true"
              />
            </Tabs.TabsTrigger>
          </Tooltip.TooltipTrigger>
          <Tooltip.TooltipContent>
            {{
              i18n.t("common.inspector")
            }}
          </Tooltip.TooltipContent>
        </Tooltip.Tooltip>
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <Tabs.TabsTrigger
              value="ai"
              class="min-w-0"
              :aria-label="i18n.t('ai.title')"
            >
              <Sparkles
                class="size-4"
                aria-hidden="true"
              />
            </Tabs.TabsTrigger>
          </Tooltip.TooltipTrigger>
          <Tooltip.TooltipContent>
            {{ i18n.t("ai.title") }}
          </Tooltip.TooltipContent>
        </Tooltip.Tooltip>
      </Tabs.TabsList>
      <UiActionButton
        class="shrink-0"
        :tooltip="i18n.t('action.close')"
        @click="emit('close')"
      >
        <X class="size-4" />
      </UiActionButton>
    </div>
    <Tabs.TabsContent
      value="inspector"
      class="min-h-0 flex-1 overflow-hidden"
    >
      <slot />
    </Tabs.TabsContent>
    <Tabs.TabsContent
      value="ai"
      class="min-h-0 flex-1 overflow-hidden"
    >
      <AiPanel embedded />
    </Tabs.TabsContent>
  </Tabs.Tabs>
</template>
