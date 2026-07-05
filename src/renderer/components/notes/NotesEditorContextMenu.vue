<script setup lang="ts">
import type { TableCellMenuContext } from './cm-extensions/tableBlocks'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { i18n } from '@/electron'
import { isMac } from '@/utils'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Highlighter,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Table,
  TextQuote,
  Trash2,
} from 'lucide-vue-next'

export type EditorMenuCommand =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'highlight'
  | 'code'
  | 'link'
  | 'clear-formatting'
  | 'bullet-list'
  | 'numbered-list'
  | 'task-list'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'body'
  | 'quote'
  | 'table'
  | 'callout'
  | 'horizontal-rule'
  | 'code-block'
  | 'table-insert-row-above'
  | 'table-insert-row-below'
  | 'table-insert-column-left'
  | 'table-insert-column-right'
  | 'table-delete-row'
  | 'table-delete-column'
  | 'table-align-left'
  | 'table-align-center'
  | 'table-align-right'

interface Props {
  hasSelection: boolean
  headingLevel: number
  // Контекст активной ячейки таблицы: включает секцию табличных команд и
  // прячет блочные (абзац/вставка), неприменимые внутри ячейки.
  table?: TableCellMenuContext | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  closeAutoFocus: [event: Event]
  command: [command: EditorMenuCommand]
}>()

const mod = isMac ? '⌘' : 'Ctrl+'
const shift = isMac ? '⇧' : 'Shift+'

const headingLevels = [1, 2, 3, 4, 5, 6] as const
const headingIcons = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
  5: Heading5,
  6: Heading6,
} as const

function run(command: EditorMenuCommand) {
  emit('command', command)
}
</script>

<template>
  <ContextMenu.ContextMenuContent
    class="w-52"
    @close-auto-focus="emit('closeAutoFocus', $event)"
  >
    <!-- Format -->
    <ContextMenu.ContextMenuSub>
      <ContextMenu.ContextMenuSubTrigger>
        <Bold />
        {{ i18n.t("notes.editor.menu.format.title") }}
      </ContextMenu.ContextMenuSubTrigger>
      <ContextMenu.ContextMenuSubContent class="w-52">
        <ContextMenu.ContextMenuItem @select="run('bold')">
          <Bold />
          {{ i18n.t("notes.editor.menu.format.bold") }}
          <ContextMenu.ContextMenuShortcut>
            {{ `${mod}B` }}
          </ContextMenu.ContextMenuShortcut>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('italic')">
          <Italic />
          {{ i18n.t("notes.editor.menu.format.italic") }}
          <ContextMenu.ContextMenuShortcut>
            {{ `${mod}I` }}
          </ContextMenu.ContextMenuShortcut>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('strikethrough')">
          <Strikethrough />
          {{ i18n.t("notes.editor.menu.format.strikethrough") }}
          <ContextMenu.ContextMenuShortcut>
            {{ `${mod}${shift}S` }}
          </ContextMenu.ContextMenuShortcut>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('highlight')">
          <Highlighter />
          {{ i18n.t("notes.editor.menu.format.highlight") }}
          <ContextMenu.ContextMenuShortcut>
            {{ `${mod}${shift}H` }}
          </ContextMenu.ContextMenuShortcut>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('code')">
          <Code />
          {{ i18n.t("notes.editor.menu.format.code") }}
          <ContextMenu.ContextMenuShortcut>
            {{ `${mod}E` }}
          </ContextMenu.ContextMenuShortcut>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('link')">
          <Link />
          {{ i18n.t("notes.editor.menu.format.link") }}
          <ContextMenu.ContextMenuShortcut>
            {{ `${mod}K` }}
          </ContextMenu.ContextMenuShortcut>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem
          :disabled="!props.hasSelection"
          @select="run('clear-formatting')"
        >
          <RemoveFormatting />
          {{ i18n.t("notes.editor.menu.format.clearFormatting") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuSubContent>
    </ContextMenu.ContextMenuSub>

    <!-- Table: только при активной ячейке таблицы -->
    <ContextMenu.ContextMenuSub v-if="props.table">
      <ContextMenu.ContextMenuSubTrigger>
        <Table />
        {{ i18n.t("notes.editor.menu.table.title") }}
      </ContextMenu.ContextMenuSubTrigger>
      <ContextMenu.ContextMenuSubContent class="w-56">
        <ContextMenu.ContextMenuItem
          :disabled="props.table.isHeader"
          @select="run('table-insert-row-above')"
        >
          <ArrowUpToLine />
          {{ i18n.t("notes.editor.menu.table.insertRowAbove") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('table-insert-row-below')">
          <ArrowDownToLine />
          {{ i18n.t("notes.editor.menu.table.insertRowBelow") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem
          :disabled="props.table.isHeader"
          @select="run('table-delete-row')"
        >
          <Trash2 />
          {{ i18n.t("notes.editor.menu.table.deleteRow") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @select="run('table-insert-column-left')">
          <ArrowLeftToLine />
          {{ i18n.t("notes.editor.menu.table.insertColumnLeft") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('table-insert-column-right')">
          <ArrowRightToLine />
          {{ i18n.t("notes.editor.menu.table.insertColumnRight") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem
          :disabled="!props.table.canDeleteColumn"
          @select="run('table-delete-column')"
        >
          <Trash2 />
          {{ i18n.t("notes.editor.menu.table.deleteColumn") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuCheckboxItem
          :checked="props.table.alignment === 'left'"
          @select="run('table-align-left')"
        >
          <AlignLeft />
          {{ i18n.t("notes.editor.menu.table.alignLeft") }}
        </ContextMenu.ContextMenuCheckboxItem>
        <ContextMenu.ContextMenuCheckboxItem
          :checked="props.table.alignment === 'center'"
          @select="run('table-align-center')"
        >
          <AlignCenter />
          {{ i18n.t("notes.editor.menu.table.alignCenter") }}
        </ContextMenu.ContextMenuCheckboxItem>
        <ContextMenu.ContextMenuCheckboxItem
          :checked="props.table.alignment === 'right'"
          @select="run('table-align-right')"
        >
          <AlignRight />
          {{ i18n.t("notes.editor.menu.table.alignRight") }}
        </ContextMenu.ContextMenuCheckboxItem>
      </ContextMenu.ContextMenuSubContent>
    </ContextMenu.ContextMenuSub>

    <!-- Paragraph -->
    <ContextMenu.ContextMenuSub v-if="!props.table">
      <ContextMenu.ContextMenuSubTrigger>
        <Pilcrow />
        {{ i18n.t("notes.editor.menu.paragraph.title") }}
      </ContextMenu.ContextMenuSubTrigger>
      <ContextMenu.ContextMenuSubContent class="w-52">
        <ContextMenu.ContextMenuItem @select="run('bullet-list')">
          <List />
          {{ i18n.t("notes.editor.menu.paragraph.bulletList") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('numbered-list')">
          <ListOrdered />
          {{ i18n.t("notes.editor.menu.paragraph.numberedList") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('task-list')">
          <ListChecks />
          {{ i18n.t("notes.editor.menu.paragraph.taskList") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuCheckboxItem
          v-for="level in headingLevels"
          :key="level"
          :checked="props.headingLevel === level"
          @select="run(`heading-${level}` as EditorMenuCommand)"
        >
          <component :is="headingIcons[level]" />
          {{ i18n.t("notes.editor.menu.paragraph.heading", { level }) }}
        </ContextMenu.ContextMenuCheckboxItem>
        <ContextMenu.ContextMenuCheckboxItem
          :checked="props.headingLevel === 0"
          @select="run('body')"
        >
          {{ i18n.t("notes.editor.menu.paragraph.body") }}
        </ContextMenu.ContextMenuCheckboxItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @select="run('quote')">
          <TextQuote />
          {{ i18n.t("notes.editor.menu.paragraph.quote") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuSubContent>
    </ContextMenu.ContextMenuSub>

    <ContextMenu.ContextMenuSeparator v-if="!props.table" />

    <!-- Insert -->
    <ContextMenu.ContextMenuSub v-if="!props.table">
      <ContextMenu.ContextMenuSubTrigger>
        <Table />
        {{ i18n.t("notes.editor.menu.insert.title") }}
      </ContextMenu.ContextMenuSubTrigger>
      <ContextMenu.ContextMenuSubContent class="w-52">
        <ContextMenu.ContextMenuItem @select="run('table')">
          <Table />
          {{ i18n.t("notes.editor.menu.insert.table") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('callout')">
          <TextQuote />
          {{ i18n.t("notes.editor.menu.insert.callout") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @select="run('horizontal-rule')">
          <Minus />
          {{ i18n.t("notes.editor.menu.insert.horizontalRule") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @select="run('code-block')">
          <SquareCode />
          {{ i18n.t("notes.editor.menu.insert.codeBlock") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuSubContent>
    </ContextMenu.ContextMenuSub>
  </ContextMenu.ContextMenuContent>
</template>
