<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDeleteShortcut, useMathNotebook } from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'
import { FileText } from 'lucide-vue-next'

const { isCompactListMode } = useApp()
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
const sheetListRef = ref<HTMLElement>()
const isSheetListFocused = ref(false)

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

function focusSheetListItem(event: MouseEvent) {
  const target = event.currentTarget

  if (!(target instanceof HTMLElement)) {
    return
  }

  nextTick(() => {
    requestAnimationFrame(() => {
      target.focus()
    })
  })
}

function selectSheetFromList(id: string, event: MouseEvent) {
  selectSheet(id)
  isSheetListFocused.value = true
  focusSheetListItem(event)
}

function deleteActiveSheet() {
  if (!activeSheetId.value) {
    return
  }

  deleteSheet(activeSheetId.value)
}

useDeleteShortcut({
  rootSelector: '[data-math-sheets-list]',
  isEnabled: () =>
    isSheetListFocused.value
    && activeSheetId.value !== null
    && editingId.value === null,
  onDelete: deleteActiveSheet,
})

onClickOutside(sheetListRef, () => {
  isSheetListFocused.value = false
})

defineExpose({
  handleCreateSheet,
})
</script>

<template>
  <div
    ref="sheetListRef"
    data-math-sheets-list
    class="flex h-full flex-col overflow-hidden"
  >
    <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-2">
      <ContextMenu.ContextMenu
        v-for="sheet in sheets"
        :key="sheet.id"
      >
        <ContextMenu.ContextMenuTrigger as-child>
          <SidebarItem
            class="group mb-0.5 cursor-default transition-colors duration-75"
            :class="activeSheetId === sheet.id ? 'text-accent-foreground' : ''"
            :selected="activeSheetId === sheet.id"
            tabindex="-1"
            @click="(event) => selectSheetFromList(sheet.id, event)"
            @dblclick="startRename(sheet.id, sheet.name)"
          >
            <div class="flex items-center gap-2 px-2 py-0.5">
              <FileText
                class="h-3.5 w-3.5 shrink-0 transition-colors"
                :class="
                  activeSheetId === sheet.id
                    ? 'text-accent-foreground'
                    : 'text-muted-foreground'
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
                  <div
                    :class="isCompactListMode ? 'flex items-center gap-2' : ''"
                  >
                    <UiText
                      as="div"
                      variant="sm"
                      class="truncate leading-tight"
                      :class="isCompactListMode ? 'flex-1' : ''"
                    >
                      {{ sheet.name }}
                    </UiText>
                    <UiText
                      as="div"
                      variant="caption"
                      class="leading-tight transition-colors"
                      :class="isCompactListMode ? 'shrink-0' : ''"
                      muted
                    >
                      {{ format(new Date(sheet.updatedAt), "dd.MM.yyyy") }}
                    </UiText>
                  </div>
                </template>
              </div>
            </div>
          </SidebarItem>
        </ContextMenu.ContextMenuTrigger>

        <ContextMenu.ContextMenuContent>
          <ContextMenu.ContextMenuItem
            @click="startRename(sheet.id, sheet.name)"
          >
            {{ i18n.t("action.rename") }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuSeparator />
          <ContextMenu.ContextMenuItem @click="deleteSheet(sheet.id)">
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.ContextMenuItem>
        </ContextMenu.ContextMenuContent>
      </ContextMenu.ContextMenu>

      <div
        v-if="sheets.length === 0"
        class="text-muted-foreground mt-8 text-center text-[12px]"
      >
        {{ i18n.t("placeholder.emptySheetList") }}
      </div>
    </div>
  </div>
</template>
