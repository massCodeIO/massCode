<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useMathNotebook } from '@/composables'
import { i18n } from '@/electron'
import { FileText, Plus } from 'lucide-vue-next'

const {
  sheets,
  activeSheetId,
  createSheet,
  deleteSheet,
  selectSheet,
  renameSheet,
} = useMathNotebook()

const editingId = ref<string | null>(null)
const editingName = ref('')

function handleCreateSheet() {
  const id = createSheet()
  const sheet = sheets.value.find(sheet => sheet.id === id)

  if (sheet) {
    startRename(sheet.id, sheet.name)
  }
}

function startRename(id: string, currentName: string) {
  editingId.value = id
  editingName.value = currentName
  nextTick(() => {
    const input = document.querySelector(
      '.sheet-rename-input',
    ) as HTMLInputElement
    input?.focus()
    input?.select()
  })
}

function finishRename(id: string) {
  if (editingName.value.trim()) {
    renameSheet(id, editingName.value.trim())
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="_mt-1 flex items-center justify-between px-2 pb-2 select-none">
      <div class="text-[10px] font-bold uppercase">
        {{ i18n.t("mathNotebook.sheetList") }}
      </div>
      <UiActionButton
        :tooltip="i18n.t('mathNotebook.newSheet')"
        @click="handleCreateSheet"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>

    <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-2">
      <ContextMenu.Root
        v-for="sheet in sheets"
        :key="sheet.id"
      >
        <ContextMenu.Trigger as-child>
          <div
            class="group mb-0.5 flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-75"
            :class="
              activeSheetId === sheet.id
                ? 'bg-list-selection text-list-selection-fg'
                : 'hover:bg-list-selection/50'
            "
            @click="selectSheet(sheet.id)"
            @dblclick="startRename(sheet.id, sheet.name)"
          >
            <FileText
              class="h-3.5 w-3.5 shrink-0 transition-colors"
              :class="
                activeSheetId === sheet.id
                  ? 'text-list-selection-fg/60'
                  : 'text-text-muted/40'
              "
              :stroke-width="1.5"
            />
            <div class="min-w-0 flex-1">
              <input
                v-if="editingId === sheet.id"
                v-model="editingName"
                class="sheet-rename-input w-full bg-transparent text-[13px] outline-none"
                @blur="finishRename(sheet.id)"
                @keydown.enter="finishRename(sheet.id)"
                @keydown.escape="cancelRename"
                @click.stop
              >
              <template v-else>
                <div class="truncate text-[13px] leading-tight">
                  {{ sheet.name }}
                </div>
                <div
                  class="text-[10px] leading-tight transition-colors"
                  :class="
                    activeSheetId === sheet.id
                      ? 'text-list-selection-fg/40'
                      : 'text-text-muted/40'
                  "
                >
                  {{ formatDate(sheet.updatedAt) }}
                </div>
              </template>
            </div>
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Content>
          <ContextMenu.Item @click="startRename(sheet.id, sheet.name)">
            {{ i18n.t("action.rename") }}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item
            class="text-red-400"
            @click="deleteSheet(sheet.id)"
          >
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>

      <div
        v-if="sheets.length === 0"
        class="text-text-muted/30 mt-8 text-center text-[12px]"
      >
        {{ i18n.t("placeholder.emptySheetList") }}
      </div>
    </div>
  </div>
</template>
