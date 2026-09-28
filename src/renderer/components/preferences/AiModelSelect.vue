<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Command from '@/components/ui/shadcn/command'
import * as Popover from '@/components/ui/shadcn/popover'
import { i18n } from '@/electron'
import { Check, ChevronsUpDown } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  models: string[]
  disabled: boolean
}>()
const emit = defineEmits<{
  select: [value: string]
}>()
const open = ref(false)
const availableModels = computed(() =>
  props.modelValue && !props.models.includes(props.modelValue)
    ? [props.modelValue, ...props.models]
    : props.models,
)

function select(value: string) {
  open.value = false
  emit('select', value)
}
</script>

<template>
  <Popover.Popover v-model:open="open">
    <Popover.PopoverTrigger as-child>
      <Button
        variant="outline"
        class="w-64 max-w-full justify-between"
        :disabled="disabled"
        :aria-label="i18n.t('ai.model')"
      >
        <span
          class="truncate"
          :class="!modelValue && 'text-muted-foreground'"
        >
          {{ modelValue || i18n.t("ai.chooseModel") }}
        </span>
        <ChevronsUpDown
          class="size-4 shrink-0 opacity-50"
          aria-hidden="true"
        />
      </Button>
    </Popover.PopoverTrigger>
    <Popover.PopoverContent
      class="w-80 max-w-[calc(100vw-2rem)] p-0"
      align="start"
    >
      <Command.Command :model-value="modelValue">
        <Command.CommandInput
          class="h-9"
          :placeholder="i18n.t('ai.searchModels')"
          :aria-label="i18n.t('ai.searchModels')"
        />
        <Command.CommandEmpty>
          {{ i18n.t("ai.noModelsFound") }}
        </Command.CommandEmpty>
        <Command.CommandList class="scrollbar max-h-60 overflow-y-auto">
          <Command.CommandGroup>
            <Command.CommandItem
              v-for="id in availableModels"
              :key="id"
              :value="id"
              @select="select(id)"
            >
              <span class="truncate">{{ id }}</span>
              <Check
                class="ml-auto size-4"
                :class="modelValue === id ? 'opacity-100' : 'opacity-0'"
                aria-hidden="true"
              />
            </Command.CommandItem>
          </Command.CommandGroup>
        </Command.CommandList>
      </Command.Command>
      <div class="border-border border-t p-1">
        <Button
          variant="ghost"
          class="w-full justify-start"
          @click="select('__manual__')"
        >
          {{ i18n.t("ai.enterModelId") }}
        </Button>
      </div>
    </Popover.PopoverContent>
  </Popover.Popover>
</template>
