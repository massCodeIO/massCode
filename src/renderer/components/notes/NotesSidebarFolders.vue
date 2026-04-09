<script setup lang="ts">
import type { TreeNode as TreeNodeType } from '@/components/ui/tree/types'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { Tree as UiTree } from '@/components/ui/tree'
import {
  useNoteFolderDragDrop,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteSearch,
  useResizeHandle,
} from '@/composables'
import { i18n, store } from '@/electron'
import { router, RouterName } from '@/router'
import { Folder, Plus } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { LAYOUT_DEFAULTS } from '~/main/store/constants'
import {
  getVisibleSelectedFolderIds,
  shouldHandleFolderClick,
} from './notesSidebarSelection'

const tagsHandleRef = ref<HTMLElement>()

function normalizeTagsHeight(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 100) {
    return LAYOUT_DEFAULTS.tags.height
  }
  return Math.max(LAYOUT_DEFAULTS.tags.min, value)
}

const tagsHeight = ref(
  normalizeTagsHeight(
    store.app.get('notes.layout.tagsListHeight') as number | undefined,
  ),
)

useResizeHandle(tagsHandleRef, {
  direction: 'vertical',
  onMove(dy) {
    tagsHeight.value = Math.max(
      LAYOUT_DEFAULTS.tags.min,
      tagsHeight.value - dy,
    )
  },
  onEnd() {
    store.app.set('notes.layout.tagsListHeight', tagsHeight.value)
  },
})

const {
  notesState,
  highlightedFolderIds,
  highlightedNoteIds,
  highlightedTagId,
  focusedFolderId,
} = useNotesApp()
const {
  createNoteFolderAndSelect,
  folders,
  updateNoteFolder,
  getFolderByIdFromTree,
  selectedFolderIds,
  selectNoteFolder,
} = useNoteFolders()
const { getNotes, withNotesLoading, selectFirstNote, isRestoreStateBlocked }
  = useNotes()
const { clearSearch } = useNoteSearch()
const { onDragNode, onExternalDrop } = useNoteFolderDragDrop()
const route = useRoute()

// --- Data mapping ---

function mapToTreeNode(folder: any): TreeNodeType {
  return {
    id: folder.id,
    label: folder.name,
    isExpanded: Boolean(folder.isOpen),
    children: folder.children?.map(mapToTreeNode) || [],
  }
}

const treeData = computed(() => folders.value?.map(mapToTreeNode) || [])

const selectedIds = computed({
  get: () =>
    getVisibleSelectedFolderIds(
      typeof route.name === 'string' ? route.name : undefined,
      selectedFolderIds.value,
    ) as (string | number)[],
  set: (val) => {
    selectedFolderIds.value = val as number[]
  },
})

const editableId = ref<string | number | null>(null)

const focusedId = computed({
  get: () => focusedFolderId.value as string | number | undefined,
  set: (val) => {
    focusedFolderId.value = val as number | undefined
  },
})

const highlightedIds = computed({
  get: () => highlightedFolderIds.value as Set<string | number>,
  set: (val) => {
    highlightedFolderIds.value.clear()
    val.forEach(id => highlightedFolderIds.value.add(id as number))
  },
})

// --- Context menu state ---

const contextNode = ref<any>(null)

// --- Event handlers ---

async function onClickNode({
  node,
  event,
}: {
  node: TreeNodeType
  event?: MouseEvent
}) {
  highlightedFolderIds.value.clear()
  highlightedTagId.value = undefined
  notesState.tagId = undefined

  const id = Number(node.id)

  if (event?.shiftKey) {
    await selectNoteFolder(id, { mode: 'range', ensureVisibility: false })
    return
  }

  if (event && (event.metaKey || event.ctrlKey)) {
    await selectNoteFolder(id, { mode: 'toggle', ensureVisibility: false })
    return
  }

  if (
    shouldHandleFolderClick(
      typeof route.name === 'string' ? route.name : undefined,
      notesState.folderId,
      id,
      selectedFolderIds.value.length,
    )
  ) {
    isRestoreStateBlocked.value = true
    clearSearch()

    if (route.name !== RouterName.notesSpace) {
      await router.push({ name: RouterName.notesSpace })
    }

    await withNotesLoading(async () => {
      await selectNoteFolder(id)
      await getNotes({ folderId: id })
      selectFirstNote()
    })
  }
}

function onDblclickNode(node: TreeNodeType) {
  setTimeout(() => {
    editableId.value = node.id
  }, 100)
}

function onToggleNode(node: TreeNodeType) {
  const folderNode = getFolderByIdFromTree(folders.value, Number(node.id))
  if (folderNode) {
    updateNoteFolder(Number(node.id), {
      isOpen: !folderNode.isOpen ? 1 : 0,
    })
  }
}

function onContextMenu({
  node,
}: {
  node: TreeNodeType
  selectedNodes: TreeNodeType[]
}) {
  contextNode.value = getFolderByIdFromTree(folders.value, Number(node.id))
  highlightedNoteIds.value.clear()
}

function onUpdateLabel({ node, value }: { node: TreeNodeType, value: string }) {
  updateNoteFolder(Number(node.id), { name: value })
  editableId.value = null
}

function onCancelEdit() {
  editableId.value = null
}
</script>

<template>
  <SidebarSectionHeader :title="i18n.t('common.folders')">
    <template #action>
      <UiActionButton
        :tooltip="i18n.t('action.new.folder')"
        @click="createNoteFolderAndSelect()"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </template>
  </SidebarSectionHeader>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="min-h-0 flex-1">
      <div class="min-h-0 flex-1 overflow-y-auto">
        <ContextMenu.ContextMenu>
          <ContextMenu.ContextMenuTrigger as-child>
            <UiTree
              v-if="treeData.length"
              :model-value="treeData"
              :selected-ids="selectedIds"
              :editable-id="editableId"
              :focused-id="focusedId"
              :highlighted-ids="highlightedIds"
              class="h-full px-0.5 pb-1"
              @click-node="onClickNode"
              @dblclick-node="onDblclickNode"
              @toggle-node="onToggleNode"
              @drag-node="onDragNode"
              @external-drop="onExternalDrop"
              @context-menu="onContextMenu"
              @update-label="onUpdateLabel"
              @cancel-edit="onCancelEdit"
              @update:selected-ids="selectedIds = $event"
              @update:editable-id="editableId = $event"
              @update:focused-id="focusedId = $event"
              @update:highlighted-ids="highlightedIds = $event"
            >
              <template #icon="{ node }">
                <div class="mr-1.5 flex flex-shrink-0 items-center">
                  <UiFolderIcon
                    v-if="getFolderByIdFromTree(folders, Number(node.id))?.icon"
                    :name="
                      getFolderByIdFromTree(folders, Number(node.id))!.icon!
                    "
                  />
                  <Folder
                    v-else
                    class="h-4 w-4"
                  />
                </div>
              </template>
            </UiTree>
          </ContextMenu.ContextMenuTrigger>
          <UiEmptyPlaceholder
            v-if="!treeData.length"
            :text="i18n.t('placeholder.emptyFoldersList')"
          />
          <NotesSidebarFolderContextMenu
            :context-node="contextNode"
            :editable-id="editableId"
            @update:editable-id="editableId = $event"
          />
        </ContextMenu.ContextMenu>
      </div>
    </div>
    <div
      ref="tagsHandleRef"
      class="before:bg-border hover:before:bg-primary data-[resizing]:before:bg-primary relative z-10 flex h-px shrink-0 cursor-row-resize items-center justify-center bg-transparent before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:transition-[background-color,height] before:duration-150 before:content-[''] after:absolute after:inset-x-0 after:top-1/2 after:h-3 after:-translate-y-1/2 after:content-[''] hover:before:h-0.5 hover:before:delay-200 data-[resizing]:before:h-0.5"
    />
    <div
      :style="{ height: `${tagsHeight}px` }"
      class="shrink-0 overflow-hidden"
    >
      <div class="flex h-full min-h-0 flex-col">
        <SidebarSectionHeader :title="i18n.t('common.tags')" />
        <div class="min-h-0 flex-1 px-1 pb-1">
          <NotesSidebarTags />
        </div>
      </div>
    </div>
  </div>
</template>
