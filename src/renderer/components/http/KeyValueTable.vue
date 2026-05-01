<script setup lang="ts">
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Popover from '@/components/ui/shadcn/popover'
import { i18n } from '@/electron'
import { Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-vue-next'

interface Entry {
  key: string
  value: string
  description?: string
  enabled?: boolean
}

const model = defineModel<Entry[]>({ required: true })

function isEnabled(entry: Entry): boolean {
  return entry.enabled !== false
}

function setEnabled(index: number, value: boolean) {
  const entry = model.value[index]
  if (!entry)
    return
  model.value.splice(index, 1, { ...entry, enabled: value })
}

function addRow() {
  model.value.push({ key: '', value: '', description: '', enabled: true })
}

function removeRow(index: number) {
  model.value.splice(index, 1)
}

function duplicateRow(index: number) {
  const entry = model.value[index]
  if (!entry)
    return
  model.value.splice(index + 1, 0, { ...entry })
}
</script>

<template>
  <div class="flex flex-col">
    <div
      class="text-muted-foreground border-border grid grid-cols-[20px_1fr_1fr_1fr_24px] items-center gap-2 border-b px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase"
    >
      <span />
      <span>{{ i18n.t("spaces.http.editor.keyValue.key") }}</span>
      <span>{{ i18n.t("spaces.http.editor.keyValue.value") }}</span>
      <span>{{ i18n.t("spaces.http.editor.keyValue.description") }}</span>
      <span />
    </div>
    <div
      v-for="(entry, index) in model"
      :key="index"
      class="border-border hover:bg-accent-hover grid grid-cols-[20px_1fr_1fr_1fr_24px] items-center gap-2 border-b px-2 py-1"
      :class="{ 'opacity-50': !isEnabled(entry) }"
    >
      <Checkbox
        :model-value="isEnabled(entry)"
        @update:model-value="(v) => setEnabled(index, !!v)"
      />
      <UiInput
        v-model="entry.key"
        class="!h-7 font-mono"
        variant="ghost"
        :placeholder="i18n.t('spaces.http.editor.keyValue.key')"
      />
      <UiInput
        v-model="entry.value"
        class="!h-7 font-mono"
        variant="ghost"
        :placeholder="i18n.t('spaces.http.editor.keyValue.value')"
      />
      <UiInput
        v-model="entry.description"
        class="!h-7"
        variant="ghost"
        :placeholder="i18n.t('spaces.http.editor.keyValue.description')"
      />
      <Popover.Popover>
        <Popover.PopoverTrigger as-child>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-6 w-6 items-center justify-center rounded"
          >
            <MoreHorizontal class="h-3.5 w-3.5" />
          </button>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent
          align="end"
          class="w-40 p-1"
        >
          <button
            type="button"
            class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
            @click="duplicateRow(index)"
          >
            <Copy class="h-3.5 w-3.5" />
            {{ i18n.t("action.duplicate") }}
          </button>
          <button
            type="button"
            class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
            @click="removeRow(index)"
          >
            <Trash2 class="h-3.5 w-3.5" />
            {{ i18n.t("action.delete.common") }}
          </button>
        </Popover.PopoverContent>
      </Popover.Popover>
    </div>
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground mt-1 inline-flex h-7 w-fit items-center gap-1 rounded px-2 text-xs"
      @click="addRow"
    >
      <Plus class="h-3.5 w-3.5" />
      {{ i18n.t("spaces.http.editor.keyValue.addRow") }}
    </button>
  </div>
</template>
