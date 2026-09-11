<script setup lang="ts" generic="T extends Entry = Entry">
import type { Entry } from './keyValueTable'
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Popover from '@/components/ui/shadcn/popover'
import { i18n } from '@/electron'
import { Copy, MoreHorizontal, Trash2 } from 'lucide-vue-next'
import { parseBulkEntries, serializeBulkEntries } from './keyValueTable'

interface Column {
  key: string
  label: string
  placeholder?: string
  width?: string
}

type RowActionMode = 'delete' | 'menu' | 'none'

const props = withDefaults(
  defineProps<{
    bulkEdit?: boolean
    fill?: boolean
    columns?: Column[]
    showEnabled?: boolean
    actions?: RowActionMode
    duplicateRows?: boolean
    emptyText?: string
    addLabel?: string
    gridTemplateColumns?: string
    createEntry?: () => T
    beforeRemove?: (entry: T, index: number) => boolean | Promise<boolean>
  }>(),
  {
    bulkEdit: false,
    fill: true,
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
    createEntry: undefined,
    beforeRemove: undefined,
  },
)

const model = defineModel<T[]>({ required: true })

const isBulkEditing = ref(false)
const bulkText = ref('')
let lastBulkSerialized = ''

function toggleBulkEdit() {
  if (!isBulkEditing.value)
    bulkText.value = serializeBulkEntries(model.value)
  isBulkEditing.value = !isBulkEditing.value
}

function updateBulkText(value: string) {
  bulkText.value = value
  const entries = parseBulkEntries(value, model.value, props.createEntry)
  lastBulkSerialized = serializeBulkEntries(entries)
  model.value = entries
}

watch(
  model,
  (value) => {
    const serialized = serializeBulkEntries(value)
    if (isBulkEditing.value && serialized !== lastBulkSerialized)
      bulkText.value = serialized
  },
  { deep: true },
)

const resolvedGridTemplateColumns = computed(() => {
  if (props.gridTemplateColumns)
    return props.gridTemplateColumns

  const parts = [
    props.showEnabled ? '20px' : '',
    ...props.columns.map(column => column.width ?? '1fr'),
    props.bulkEdit ? '11rem' : props.actions !== 'none' ? '24px' : '',
  ].filter(Boolean)

  return parts.join(' ')
})

const tableRows = computed(() =>
  model.value.map((entry, index) => ({ entry, index })),
)
const tableColumns = computed(() => [
  ...(props.showEnabled
    ? [{ key: '__enabled', label: '', width: '20px' }]
    : []),
  ...props.columns,
  ...(props.bulkEdit || props.actions !== 'none'
    ? [{ key: '__actions', label: '', width: '24px' }]
    : []),
])
const revealRowKey = ref<number>()
const rowIds = new WeakMap<Entry, number>()
let nextRowId = 0
function rowKey(row: { entry: T }) {
  if (!rowIds.has(row.entry))
    rowIds.set(row.entry, ++nextRowId)
  return rowIds.get(row.entry)!
}
function rowClass(row: { entry: T }) {
  return props.showEnabled && !isEnabled(row.entry) ? 'opacity-50' : ''
}

function isEnabled(entry: T): boolean {
  return entry.enabled !== false
}

function setEnabled(index: number, value: boolean) {
  const entry = model.value[index]
  if (!entry)
    return
  model.value.splice(index, 1, { ...entry, enabled: value })
}

function addRow() {
  const entry
    = props.createEntry?.()
      ?? ({
        description: '',
        enabled: true,
        key: '',
        value: '',
      } as T)

  model.value.push(entry)
  revealRowKey.value = rowKey({ entry: model.value[model.value.length - 1]! })
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

  // За время диалога подтверждения список мог быть пересобран: индекс уже
  // может указывать на другую строку, а самой строки может не быть.
  const currentIndex = model.value.indexOf(entry)
  if (currentIndex === -1)
    return

  model.value.splice(currentIndex, 1)
}

function duplicateRow(index: number) {
  const entry = model.value[index]
  if (!entry)
    return
  model.value.splice(index + 1, 0, { ...entry })
  revealRowKey.value = rowKey({ entry: model.value[index + 1]! })
}
</script>

<template>
  <div
    class="flex min-h-0 flex-col"
    :class="{ 'h-full': fill }"
  >
    <div
      v-if="bulkEdit && isBulkEditing"
      class="flex shrink-0 items-center gap-2 border-b border-transparent px-2 py-1"
    >
      <UiText
        variant="caption"
        muted
        class="min-w-0 flex-1 truncate"
        :title="i18n.t('spaces.http.editor.keyValue.bulkHint')"
      >
        {{ i18n.t("spaces.http.editor.keyValue.bulkHint") }}
      </UiText>
      <Button
        type="button"
        variant="ghost"
        class="h-6 w-auto shrink-0 font-normal tracking-normal normal-case"
        :aria-pressed="isBulkEditing"
        @click="toggleBulkEdit"
      >
        <UiText variant="caption">
          {{
            i18n.t(
              isBulkEditing
                ? "spaces.http.editor.keyValue.keyValueEdit"
                : "spaces.http.editor.keyValue.bulkEdit",
            )
          }}
        </UiText>
      </Button>
    </div>
    <template v-if="isBulkEditing">
      <HttpBodyEditor
        :model-value="bulkText"
        class="mb-2 min-h-0 flex-1"
        @update:model-value="updateBulkText"
      />
    </template>
    <UiEditableTable
      v-else
      :class="{ 'h-full': fill }"
      :fill="fill"
      :rows="tableRows"
      :columns="tableColumns"
      :row-key="rowKey"
      :reveal-row-key="revealRowKey"
      :row-class="rowClass"
      :grid-template-columns="resolvedGridTemplateColumns"
      :empty-text="emptyText"
      :label="i18n.t('spaces.http.editor.keyValue.key')"
    >
      <template
        v-for="column in columns"
        :key="column.key"
        #[`header-${column.key}`]
      >
        <div class="truncate border border-transparent px-2">
          {{ column.label }}
        </div>
      </template>
      <template
        v-if="bulkEdit"
        #header-__actions
      >
        <div class="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            class="h-6 w-auto font-normal tracking-normal normal-case"
            :aria-pressed="false"
            @click="toggleBulkEdit"
          >
            <UiText variant="caption">
              {{ i18n.t("spaces.http.editor.keyValue.bulkEdit") }}
            </UiText>
          </Button>
        </div>
      </template>
      <template
        v-if="showEnabled"
        #cell-__enabled="{ row: { entry, index } }"
      >
        <Checkbox
          :model-value="isEnabled(entry)"
          @update:model-value="(v) => setEnabled(index, !!v)"
        />
      </template>
      <template
        v-for="column in columns"
        :key="column.key"
        #[`cell-${column.key}`]="{ row: { entry, index } }"
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

      <template #cell-__actions="{ row: { entry, index } }">
        <div class="flex justify-end">
          <Popover.Popover v-if="actions === 'menu'">
            <Popover.PopoverTrigger as-child>
              <Button
                type="button"
                variant="icon"
                size="icon"
                class="size-6"
                :aria-label="i18n.t('action.rowActions')"
              >
                <MoreHorizontal class="h-3.5 w-3.5" />
              </Button>
            </Popover.PopoverTrigger>
            <Popover.PopoverContent
              align="end"
              class="w-max max-w-(--reka-popover-content-available-width) min-w-[min(10rem,var(--reka-popover-content-available-width))] p-1"
            >
              <Button
                v-if="duplicateRows"
                type="button"
                variant="ghost"
                class="w-full justify-start"
                @click="duplicateRow(index)"
              >
                <Copy class="h-3.5 w-3.5 shrink-0" />
                <UiText class="min-w-0 truncate leading-5 text-inherit">
                  {{ i18n.t("action.duplicate") }}
                </UiText>
              </Button>
              <Button
                type="button"
                variant="ghost"
                class="w-full justify-start"
                @click="removeRow(index)"
              >
                <Trash2 class="h-3.5 w-3.5 shrink-0" />
                <UiText class="min-w-0 truncate leading-5 text-inherit">
                  {{ i18n.t("action.delete.common") }}
                </UiText>
              </Button>
            </Popover.PopoverContent>
          </Popover.Popover>

          <slot
            v-else-if="actions === 'delete'"
            name="delete-action"
            :entry="entry"
            :index="index"
            :remove-row="() => removeRow(index)"
          >
            <Button
              type="button"
              variant="icon"
              size="icon"
              class="size-6"
              :aria-label="i18n.t('action.delete.common')"
              @click="removeRow(index)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </slot>
        </div>
      </template>

      <template #footer-actions>
        <slot
          name="footer-actions"
          :add-row="addRow"
        >
          <HttpAddRowButton
            :label="addLabel"
            @click="addRow"
          />
        </slot>
      </template>
    </UiEditableTable>
  </div>
</template>
