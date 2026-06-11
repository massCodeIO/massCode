<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useApp,
  useCopyToClipboard,
  useDeleteShortcut,
  useDrawings,
  useInlineRename,
} from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'
import { Shapes } from 'lucide-vue-next'

const { isCompactListMode } = useApp()
const {
  drawings,
  activeDrawingId,
  createDrawing,
  deleteDrawing,
  duplicateDrawing,
  exportDrawingImage,
  renameDrawing,
  selectDrawing,
} = useDrawings()
const copyToClipboard = useCopyToClipboard()

function copyLinkForNote(name: string) {
  copyToClipboard(`![${name}](masscode://drawing/${encodeURIComponent(name)})`)
}

const {
  editingId,
  editingName,
  startRename,
  requestRenameFromMenu,
  handleMenuCloseAutoFocus,
  finishRename,
  cancelRename,
} = useInlineRename({
  inputSelector: '.drawing-rename-input',
  onRename: (id, name) => void renameDrawing(id, name),
})

const drawingListRef = ref<HTMLElement>()
const isDrawingListFocused = ref(false)

async function handleCreateDrawing() {
  const record = await createDrawing()

  if (record) {
    startRename(record.id, record.name)
  }
}

function focusDrawingListItem(event: MouseEvent) {
  const target = event.currentTarget

  if (!(target instanceof HTMLElement)) {
    return
  }

  nextTick(() => {
    requestAnimationFrame(() => {
      // A double-click both selects and starts renaming; don't pull focus
      // away from the rename input back to the list item.
      if (editingId.value !== null) {
        return
      }
      target.focus()
    })
  })
}

function selectDrawingFromList(id: string, event: MouseEvent) {
  void selectDrawing(id)
  isDrawingListFocused.value = true
  focusDrawingListItem(event)
}

function deleteActiveDrawing() {
  if (!activeDrawingId.value) {
    return
  }

  void deleteDrawing(activeDrawingId.value)
}

useDeleteShortcut({
  rootSelector: '[data-drawings-list]',
  isEnabled: () =>
    isDrawingListFocused.value
    && activeDrawingId.value !== null
    && editingId.value === null,
  onDelete: deleteActiveDrawing,
})

onClickOutside(drawingListRef, () => {
  isDrawingListFocused.value = false
})

defineExpose({
  handleCreateDrawing,
})
</script>

<template>
  <div
    ref="drawingListRef"
    data-drawings-list
    class="flex h-full flex-col overflow-hidden"
  >
    <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-2">
      <ContextMenu.ContextMenu
        v-for="drawing in drawings"
        :key="drawing.id"
      >
        <ContextMenu.ContextMenuTrigger as-child>
          <SidebarItem
            class="group mb-0.5 cursor-default transition-colors duration-75"
            :class="
              activeDrawingId === drawing.id ? 'text-accent-foreground' : ''
            "
            :selected="activeDrawingId === drawing.id"
            tabindex="-1"
            @click="selectDrawingFromList(drawing.id, $event)"
            @dblclick="startRename(drawing.id, drawing.name)"
          >
            <div class="flex items-center gap-2 px-2 py-0.5">
              <Shapes
                class="h-3.5 w-3.5 shrink-0 transition-colors"
                :class="
                  activeDrawingId === drawing.id
                    ? 'text-accent-foreground'
                    : 'text-muted-foreground'
                "
                :stroke-width="1.5"
              />
              <div class="min-w-0 flex-1">
                <div
                  :class="isCompactListMode ? 'flex items-center gap-2' : ''"
                >
                  <input
                    v-if="editingId === drawing.id"
                    v-model="editingName"
                    class="drawing-rename-input outline-primary bg-background m-0 min-w-0 rounded-sm border-0 p-0 text-[13px] leading-tight outline outline-1"
                    :class="isCompactListMode ? 'flex-1' : 'w-full'"
                    @blur="finishRename(drawing.id)"
                    @keydown.enter="finishRename(drawing.id)"
                    @keydown.escape="cancelRename"
                    @click.stop
                  >
                  <UiText
                    v-else
                    as="div"
                    variant="sm"
                    class="truncate leading-tight"
                    :class="isCompactListMode ? 'flex-1' : ''"
                  >
                    {{ drawing.name }}
                  </UiText>
                  <UiText
                    as="div"
                    variant="caption"
                    class="leading-tight transition-colors"
                    :class="isCompactListMode ? 'shrink-0' : ''"
                    muted
                  >
                    {{ format(new Date(drawing.updatedAt), "dd.MM.yyyy") }}
                  </UiText>
                </div>
              </div>
            </div>
          </SidebarItem>
        </ContextMenu.ContextMenuTrigger>

        <ContextMenu.ContextMenuContent
          @close-auto-focus="handleMenuCloseAutoFocus"
        >
          <ContextMenu.ContextMenuItem
            @click="requestRenameFromMenu(drawing.id, drawing.name)"
          >
            {{ i18n.t("action.rename") }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuItem @click="duplicateDrawing(drawing.id)">
            {{ i18n.t("action.duplicate") }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuSeparator />
          <ContextMenu.ContextMenuItem @click="copyLinkForNote(drawing.id)">
            {{ i18n.t("spaces.drawings.copyLinkForNote") }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuItem @click="exportDrawingImage(drawing.id)">
            {{ i18n.t("spaces.drawings.exportImage") }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuSeparator />
          <ContextMenu.ContextMenuItem @click="deleteDrawing(drawing.id)">
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.ContextMenuItem>
        </ContextMenu.ContextMenuContent>
      </ContextMenu.ContextMenu>

      <div
        v-if="drawings.length === 0"
        class="text-muted-foreground mt-8 text-center text-[12px]"
      >
        {{ i18n.t("placeholder.emptyDrawingsList") }}
      </div>
    </div>
  </div>
</template>
