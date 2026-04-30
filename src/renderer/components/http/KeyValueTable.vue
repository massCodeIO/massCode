<script setup lang="ts">
import { i18n } from '@/electron'
import { Plus, X } from 'lucide-vue-next'

interface Entry {
  key: string
  value: string
}

interface Props {
  keyPlaceholder?: string
  valuePlaceholder?: string
}

const props = defineProps<Props>()

const model = defineModel<Entry[]>({ required: true })

function addRow() {
  model.value.push({ key: '', value: '' })
}

function removeRow(index: number) {
  model.value.splice(index, 1)
}
</script>

<template>
  <div class="flex flex-col">
    <div
      v-if="model.length === 0"
      class="text-muted-foreground py-2 text-xs"
    >
      {{ i18n.t("spaces.http.editor.keyValue.empty") }}
    </div>
    <div
      v-for="(entry, index) in model"
      :key="index"
      class="flex items-center gap-1 py-1"
    >
      <UiInput
        v-model="entry.key"
        class="!h-7 flex-1"
        :placeholder="
          props.keyPlaceholder ?? i18n.t('spaces.http.editor.keyValue.key')
        "
      />
      <UiInput
        v-model="entry.value"
        class="!h-7 flex-1"
        :placeholder="
          props.valuePlaceholder ?? i18n.t('spaces.http.editor.keyValue.value')
        "
      />
      <UiActionButton
        :tooltip="i18n.t('action.delete.common')"
        @click="removeRow(index)"
      >
        <X class="h-3.5 w-3.5" />
      </UiActionButton>
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
