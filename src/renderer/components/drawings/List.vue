<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useApp,
  useContentSort,
  useCopyToClipboard,
  useDeleteShortcut,
  useDialog,
  useDrawings,
  useInlineRename,
} from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'
import { Search, Shapes } from 'lucide-vue-next'

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
const { contentSortState } = useContentSort()
const { confirm } = useDialog()

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
const searchQuery = ref('')

function compareDrawingNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

const sortedDrawings = computed(() => {
  const { sort, order } = contentSortState.drawings
  const direction = order === 'ASC' ? 1 : -1

  return [...drawings.value].sort((a, b) => {
    const result
      = sort === 'name' ? compareDrawingNames(a.name, b.name) : a[sort] - b[sort]

    return result * direction
  })
})

const filteredDrawings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return sortedDrawings.value
  }

  return sortedDrawings.value.filter(drawing =>
    drawing.name.toLowerCase().includes(query),
  )
})

async function handleCreateDrawing() {
  searchQuery.value = ''
  const record = await createDrawing()

  if (record) {
    startRename(record.id, record.name)
  }
}

function scrollActiveDrawingIntoView() {
  nextTick(() => {
    drawingListRef.value
      ?.querySelector(`[data-drawing-id="${activeDrawingId.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function moveSearchSelection(delta: number) {
  const items = filteredDrawings.value

  if (items.length === 0) {
    return
  }

  const currentIndex = items.findIndex(
    item => item.id === activeDrawingId.value,
  )
  const nextIndex
    = currentIndex === -1
      ? delta > 0
        ? 0
        : items.length - 1
      : Math.min(Math.max(currentIndex + delta, 0), items.length - 1)

  void selectDrawing(items[nextIndex].id)
  scrollActiveDrawingIntoView()
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSearchSelection(1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSearchSelection(-1)
  }
  else if (event.key === 'Escape') {
    searchQuery.value = ''
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

async function confirmDeleteDrawing(id: string) {
  const drawing = drawings.value.find(item => item.id === id)

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.deletePermanently', {
      name: drawing?.name ?? '',
    }),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed) {
    return
  }

  await deleteDrawing(id)
}

function deleteActiveDrawing() {
  if (!activeDrawingId.value) {
    return
  }

  void confirmDeleteDrawing(activeDrawingId.value)
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
    <div class="mb-1 flex items-center px-2">
      <Search class="text-muted-foreground ml-1 h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('spaces.drawings.searchPlaceholder')"
          variant="ghost"
          class="truncate"
          @keydown="onSearchKeydown"
        />
      </div>
    </div>
    <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-2">
      <ContextMenu.ContextMenu
        v-for="drawing in filteredDrawings"
        :key="drawing.id"
      >
        <ContextMenu.ContextMenuTrigger as-child>
          <SidebarItem
            class="group mb-0.5 cursor-default transition-colors duration-75"
            :class="
              activeDrawingId === drawing.id ? 'text-accent-foreground' : ''
            "
            :selected="activeDrawingId === drawing.id"
            :data-drawing-id="drawing.id"
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
                    class="drawing-rename-input outline-primary bg-background m-0 block min-w-0 rounded-sm border-0 p-0 text-[13px] leading-tight outline outline-1"
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
          <ContextMenu.ContextMenuItem
            @click="confirmDeleteDrawing(drawing.id)"
          >
            {{ i18n.t("action.delete.common") }}
          </ContextMenu.ContextMenuItem>
        </ContextMenu.ContextMenuContent>
      </ContextMenu.ContextMenu>

      <div
        v-if="filteredDrawings.length === 0"
        class="text-muted-foreground mt-8 text-center text-[12px]"
      >
        {{
          searchQuery.trim()
            ? i18n.t("spaces.drawings.noResults")
            : i18n.t("placeholder.emptyDrawingsList")
        }}
      </div>
    </div>
  </div>
</template>
