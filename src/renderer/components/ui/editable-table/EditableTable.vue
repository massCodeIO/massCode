<script setup lang="ts" generic="Row extends object">
import type { CellCommit, EditableColumn } from './types'
import { cn } from '@/utils'
import { rowVariants, textVariants } from './variants'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'compact'
    rows: readonly Row[]
    columns: readonly EditableColumn<Row>[]
    rowKey: (row: Row) => string | number
    label: string
    commit?: CellCommit<Row>
    disabled?: boolean
    showHeader?: boolean
    cellBorders?: boolean
    emptyText?: string
    replaceRow?: (row: Row) => boolean
  }>(),
  { variant: 'default', showHeader: undefined, cellBorders: undefined },
)
const emit = defineEmits<{
  input: [row: Row, column: EditableColumn<Row>, value: string]
  blur: [row: Row, column: EditableColumn<Row>]
}>()
const headerVisible = computed(
  () => props.showHeader ?? props.variant === 'default',
)
const bordersVisible = computed(
  () => props.cellBorders ?? props.variant === 'compact',
)
const grid = computed(() =>
  props.columns.map(column => column.width ?? 'minmax(0,1fr)').join(' '),
)
function value(row: Row, column: EditableColumn<Row>) {
  return column.value
    ? column.value(row)
    : String((row as Record<string, unknown>)[column.key] ?? '')
}
function editable(row: Row, column: EditableColumn<Row>) {
  return typeof column.editable === 'function'
    ? column.editable(row)
    : column.editable === true
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      role="table"
      :aria-label="label"
      class="flex min-h-0 flex-1 flex-col"
    >
      <div
        v-if="headerVisible"
        role="rowgroup"
        class="shrink-0"
      >
        <div
          role="row"
          class="border-border text-muted-foreground grid items-center gap-2 border-b px-2 py-1"
          :style="{ gridTemplateColumns: grid }"
        >
          <UiText
            v-for="column in columns"
            :key="column.key"
            role="columnheader"
            as="div"
            variant="caption"
            weight="semibold"
            class="truncate tracking-wider uppercase"
          >
            {{ column.label }}
          </UiText>
        </div>
      </div>
      <div
        role="rowgroup"
        class="scrollbar min-h-0 flex-1 overflow-y-auto"
      >
        <div
          v-if="!rows.length && emptyText"
          role="row"
        >
          <UiText
            role="cell"
            as="div"
            variant="xs"
            muted
            class="px-2 py-2"
          >
            {{ emptyText }}
          </UiText>
        </div>
        <div
          v-for="row in rows"
          :key="rowKey(row)"
          role="row"
          :class="rowVariants({ variant })"
          :style="{ gridTemplateColumns: grid }"
        >
          <div
            v-if="replaceRow?.(row)"
            role="cell"
            class="col-span-full min-w-0"
          >
            <slot
              name="row-editor"
              :row="row"
            />
          </div>
          <template v-else>
            <div
              v-for="column in columns"
              :key="column.key"
              role="cell"
              class="min-w-0"
              :class="{
                'border-border self-stretch border-l first:border-l-0':
                  bordersVisible,
              }"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :column="column"
              >
                <UiEditableTableCell
                  v-if="editable(row, column)"
                  :value="value(row, column)"
                  :label="column.label"
                  :type="column.type"
                  :placeholder="column.placeholder"
                  :disabled="disabled"
                  :save="(next) => commit?.(row, column, next)"
                  @input="(next) => emit('input', row, column, next)"
                  @blur="emit('blur', row, column)"
                />
                <UiText
                  v-else
                  as="div"
                  variant="xs"
                  :class="
                    cn(
                      textVariants({ variant }),
                      (column.wrap ?? variant === 'compact')
                        ? 'break-all'
                        : 'truncate',
                    )
                  "
                >
                  {{ value(row, column) }}
                </UiText>
              </slot>
            </div>
          </template>
        </div>
      </div>
    </div>
    <slot name="footer" />
  </div>
</template>
