<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useApp,
  useContentSort,
  useDeleteShortcut,
  useInlineRename,
  useMathNotebook,
} from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'
import { FileText, Search } from 'lucide-vue-next'

const { isCompactListMode } = useApp()
const {
  sheets,
  activeSheetId,
  createSheet,
  deleteSheet,
  selectSheet,
  renameSheet,
} = useMathNotebook()
const { contentSortState } = useContentSort()

const {
  editingId,
  editingName,
  startRename,
  requestRenameFromMenu,
  handleMenuCloseAutoFocus,
  finishRename,
  cancelRename,
} = useInlineRename({
  inputSelector: '.sheet-rename-input',
  onRename: (id, name) => renameSheet(id, name),
})

const sheetListRef = ref<HTMLElement>()
const isSheetListFocused = ref(false)
const searchQuery = ref('')

function compareSheetNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

const sortedSheets = computed(() => {
  const { sort, order } = contentSortState.math
  const direction = order === 'ASC' ? 1 : -1

  return [...sheets.value].sort((a, b) => {
    const result
      = sort === 'name' ? compareSheetNames(a.name, b.name) : a[sort] - b[sort]

    return result * direction
  })
})

const filteredSheets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return sortedSheets.value
  }

  return sortedSheets.value.filter(sheet =>
    sheet.name.toLowerCase().includes(query),
  )
})

function handleCreateSheet() {
  searchQuery.value = ''
  const id = createSheet()
  const sheet = sheets.value.find(sheet => sheet.id === id)

  if (sheet) {
    startRename(sheet.id, sheet.name)
  }
}

function scrollActiveSheetIntoView() {
  nextTick(() => {
    sheetListRef.value
      ?.querySelector(`[data-sheet-id="${activeSheetId.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function moveSearchSelection(delta: number) {
  const items = filteredSheets.value

  if (items.length === 0) {
    return
  }

  const currentIndex = items.findIndex(
    item => item.id === activeSheetId.value,
  )
  const nextIndex
    = currentIndex === -1
      ? delta > 0
        ? 0
        : items.length - 1
      : Math.min(Math.max(currentIndex + delta, 0), items.length - 1)

  selectSheet(items[nextIndex].id)
  scrollActiveSheetIntoView()
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

function focusSheetListItem(event: MouseEvent) {
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
    <div class="mb-1 flex items-center px-2">
      <Search class="text-muted-foreground ml-1 h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('spaces.math.searchPlaceholder')"
          variant="ghost"
          class="truncate"
          @keydown="onSearchKeydown"
        />
      </div>
    </div>
    <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-2">
      <ContextMenu.ContextMenu
        v-for="sheet in filteredSheets"
        :key="sheet.id"
      >
        <ContextMenu.ContextMenuTrigger as-child>
          <SidebarItem
            class="group mb-0.5 cursor-default transition-colors duration-75"
            :class="activeSheetId === sheet.id ? 'text-accent-foreground' : ''"
            :selected="activeSheetId === sheet.id"
            :data-sheet-id="sheet.id"
            tabindex="-1"
            @click="selectSheetFromList(sheet.id, $event)"
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
                <div
                  :class="isCompactListMode ? 'flex items-center gap-2' : ''"
                >
                  <input
                    v-if="editingId === sheet.id"
                    v-model="editingName"
                    class="sheet-rename-input outline-primary bg-background m-0 min-w-0 rounded-sm border-0 p-0 text-[13px] leading-tight outline outline-1"
                    :class="isCompactListMode ? 'flex-1' : 'w-full'"
                    @blur="finishRename(sheet.id)"
                    @keydown.enter="finishRename(sheet.id)"
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
              </div>
            </div>
          </SidebarItem>
        </ContextMenu.ContextMenuTrigger>

        <ContextMenu.ContextMenuContent
          @close-auto-focus="handleMenuCloseAutoFocus"
        >
          <ContextMenu.ContextMenuItem
            @click="requestRenameFromMenu(sheet.id, sheet.name)"
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
        v-if="filteredSheets.length === 0"
        class="text-muted-foreground mt-8 text-center text-[12px]"
      >
        {{
          searchQuery.trim()
            ? i18n.t("spaces.math.noResults")
            : i18n.t("placeholder.emptySheetList")
        }}
      </div>
    </div>
  </div>
</template>
