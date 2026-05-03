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
  type?: string
  [key: string]: any
}

interface Column {
  key: string
  label: string
  placeholder?: string
  width?: string
}

type RowActionMode = 'delete' | 'menu' | 'none'

const props = withDefaults(
  defineProps<{
    columns?: Column[]
    showEnabled?: boolean
    actions?: RowActionMode
    duplicateRows?: boolean
    emptyText?: string
    addLabel?: string
    gridTemplateColumns?: string
    createEntry?: () => Entry
    beforeRemove?: (entry: Entry, index: number) => boolean | Promise<boolean>
  }>(),
  {
    columns: () => [
      {
        key: 'key',
        label: i18n.t('spaces.http.editor.keyValue.key'),
        placeholder: i18n.t('spaces.http.editor.keyValue.key'),
      },
      {
        key: 'value',
        label: i18n.t('spaces.http.editor.keyValue.value'),
        placeholder: i18n.t('spaces.http.editor.keyValue.value'),
      },
      {
        key: 'description',
        label: i18n.t('spaces.http.editor.keyValue.description'),
        placeholder: i18n.t('spaces.http.editor.keyValue.description'),
      },
    ],
    showEnabled: true,
    actions: 'menu',
    duplicateRows: true,
    emptyText: '',
    addLabel: () => i18n.t('spaces.http.editor.keyValue.addRow'),
    gridTemplateColumns: '',
    createEntry: () => ({
      key: '',
      value: '',
      description: '',
      enabled: true,
    }),
    beforeRemove: undefined,
  },
)

const model = defineModel<Entry[]>({ required: true })

const resolvedGridTemplateColumns = computed(() => {
  if (props.gridTemplateColumns)
    return props.gridTemplateColumns

  const parts = [
    props.showEnabled ? '20px' : '',
    ...props.columns.map(column => column.width ?? '1fr'),
    props.actions !== 'none' ? '24px' : '',
  ].filter(Boolean)

  return parts.join(' ')
})

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
  model.value.push(props.createEntry())
}

async function removeRow(index: number) {
  const entry = model.value[index]
  if (!entry)
    return

  if (props.beforeRemove) {
    const shouldRemove = await props.beforeRemove(entry, index)
    if (!shouldRemove)
      return
  }

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
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="text-muted-foreground border-border grid items-center gap-2 border-b px-2 py-1 text-[10px] font-semibold tracking-wider uppercase"
      :style="{ gridTemplateColumns: resolvedGridTemplateColumns }"
    >
      <span v-if="showEnabled" />
      <span
        v-for="column in columns"
        :key="column.key"
      >
        {{ column.label }}
      </span>
      <span v-if="actions !== 'none'" />
    </div>

    <div class="scrollbar min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="model.length === 0 && emptyText"
        class="text-muted-foreground px-2 py-2 text-xs"
      >
        {{ emptyText }}
      </div>
      <div
        v-for="(entry, index) in model"
        :key="index"
        class="border-border hover:bg-accent-hover grid min-h-7 items-center gap-2 border-b px-2 py-0.5"
        :class="{ 'opacity-50': showEnabled && !isEnabled(entry) }"
        :style="{ gridTemplateColumns: resolvedGridTemplateColumns }"
      >
        <Checkbox
          v-if="showEnabled"
          :model-value="isEnabled(entry)"
          @update:model-value="(v) => setEnabled(index, !!v)"
        />

        <template
          v-for="column in columns"
          :key="column.key"
        >
          <slot
            :name="`cell-${column.key}`"
            :entry="entry"
            :index="index"
            :column="column"
          >
            <UiInput
              v-model="entry[column.key]"
              class="!h-6"
              variant="ghost"
              :placeholder="column.placeholder ?? column.label"
            />
          </slot>
        </template>

        <Popover.Popover v-if="actions === 'menu'">
          <Popover.PopoverTrigger as-child>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-6 items-center justify-center rounded"
            >
              <MoreHorizontal class="h-3.5 w-3.5" />
            </button>
          </Popover.PopoverTrigger>
          <Popover.PopoverContent
            align="end"
            class="w-40 p-1"
          >
            <button
              v-if="duplicateRows"
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

        <slot
          v-else-if="actions === 'delete'"
          name="delete-action"
          :entry="entry"
          :index="index"
          :remove-row="() => removeRow(index)"
        >
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-6 items-center justify-center rounded"
            @click="removeRow(index)"
          >
            <Trash2 class="size-3.5" />
          </button>
        </slot>
      </div>
    </div>

    <button
      type="button"
      class="text-muted-foreground hover:text-foreground mt-1 inline-flex h-7 w-fit items-center gap-1 rounded px-2 text-xs"
      @click="addRow"
    >
      <Plus class="h-3.5 w-3.5" />
      {{ addLabel }}
    </button>
  </div>
</template>
