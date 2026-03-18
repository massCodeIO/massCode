<script setup lang="ts">
import type { TreeNode as TreeNodeType } from '@/components/ui/tree/types'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import * as Resizable from '@/components/ui/shadcn/resizable'
import { Tree as UiTree } from '@/components/ui/tree'
import {
  useDialog,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteSearch,
} from '@/composables'
import { i18n, store } from '@/electron'
import { scrollToElement } from '@/utils'
import { Folder, Plus } from 'lucide-vue-next'
import { APP_DEFAULTS } from '~/main/store/constants'

type Position = 'after' | 'before' | 'center'

const MIN_TAGS_PANEL_SIZE = 12

function normalizeTagsListHeight(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return APP_DEFAULTS.sizes.tagsList
  }

  return Math.max(
    MIN_TAGS_PANEL_SIZE,
    Math.min(100 - MIN_TAGS_PANEL_SIZE, value),
  )
}

const tagsListHeight = normalizeTagsListHeight(
  store.app.get('sizes.notesTagsListHeight') as number | undefined,
)

const {
  notesState,
  highlightedFolderIds,
  highlightedNoteIds,
  highlightedTagId,
  focusedFolderId,
} = useNotesApp()
const {
  createNoteFolderAndSelect,
  deleteNoteFolder,
  folders,
  updateNoteFolder,
  getFolderByIdFromTree,
  getNoteFolders,
  selectedFolderIds,
  clearFolderSelection,
  selectNoteFolder,
} = useNoteFolders()
const {
  clearNotesState,
  getNotes,
  withNotesLoading,
  selectFirstNote,
  isRestoreStateBlocked,
  updateNote,
} = useNotes()
const { clearSearch, displayedNotes } = useNoteSearch()

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
  get: () => selectedFolderIds.value as (string | number)[],
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

const isContextMultiSelection = computed(() => {
  if (!contextNode.value)
    return false
  if (selectedFolderIds.value.length <= 1)
    return false
  return selectedFolderIds.value.includes(contextNode.value.id)
})

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

  if (notesState.folderId !== id || selectedFolderIds.value.length > 1) {
    isRestoreStateBlocked.value = true
    clearSearch()

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

async function onDragNode({
  nodes,
  target,
  position,
}: {
  nodes: TreeNodeType[]
  target: TreeNodeType
  position: Position
}) {
  try {
    const folderNodes = nodes
      .map(n => getFolderByIdFromTree(folders.value, Number(n.id)))
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
    const folderTarget = getFolderByIdFromTree(
      folders.value,
      Number(target.id),
    )

    if (!folderNodes.length || !folderTarget)
      return

    const movableNodes = folderNodes.filter(
      node => node.id !== folderTarget.id,
    )

    if (!movableNodes.length)
      return

    if (position === 'center') {
      const destinationParentId = Number(target.id)
      let orderIndex = folderTarget.children?.length || 0

      for (const node of movableNodes) {
        await updateNoteFolder(node.id, {
          parentId: destinationParentId,
          orderIndex,
        })
        orderIndex += 1
      }

      return
    }

    for (const node of movableNodes) {
      const isDraggingUp = node.orderIndex > folderTarget.orderIndex
      const newParentId: number | null = folderTarget.parentId || null
      let newOrderIndex: number

      if (node.parentId === folderTarget.parentId) {
        if (position === 'after') {
          newOrderIndex = isDraggingUp
            ? folderTarget.orderIndex + 1
            : folderTarget.orderIndex
        }
        else {
          newOrderIndex = isDraggingUp
            ? folderTarget.orderIndex
            : Math.max(folderTarget.orderIndex - 1, 0)
        }
      }
      else {
        newOrderIndex
          = position === 'after'
            ? folderTarget.orderIndex + 1
            : folderTarget.orderIndex
      }

      await updateNoteFolder(node.id, {
        parentId: newParentId,
        orderIndex: newOrderIndex,
      })
    }
  }
  catch (error) {
    console.error('Note folder drag error:', error)
  }
}

async function onExternalDrop({
  data,
  target,
}: {
  data: DataTransfer
  target: TreeNodeType
  position: Position
}) {
  const noteIds = JSON.parse(data.getData('noteIds') || '[]') as number[]
  const matchedNotes = displayedNotes.value?.filter(n =>
    noteIds.includes(n.id),
  )

  if (!matchedNotes?.length)
    return

  const folderId = Number(target.id)

  if (matchedNotes.every(n => n.folder?.id === folderId && !n.isDeleted))
    return

  for (const note of matchedNotes) {
    await updateNote(note.id, { folderId, isDeleted: 0 })
  }

  await getNotes()
  selectFirstNote()
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

// --- Context menu actions ---

async function onDeleteFolder() {
  if (!contextNode.value)
    return

  const { confirm } = useDialog()
  const activeBeforeDelete = notesState.folderId
  const targetIds = selectedFolderIds.value.includes(contextNode.value.id)
    ? [...selectedFolderIds.value]
    : [contextNode.value.id]
  const folderName = getFolderByIdFromTree(
    folders.value,
    contextNode.value.id,
  )?.name

  const isConfirmed = await confirm({
    title:
      targetIds.length > 1
        ? i18n.t('messages:confirm.delete', {
            name: i18n.t('sidebar.folders'),
          })
        : i18n.t('messages:confirm.delete', { name: folderName }),
  })

  if (!isConfirmed)
    return

  await Promise.all(targetIds.map(id => deleteNoteFolder(id, false)))
  await getNoteFolders(false)

  if (activeBeforeDelete && targetIds.includes(activeBeforeDelete)) {
    clearNotesState()
    const fallbackId = selectedFolderIds.value[0]

    if (fallbackId) {
      await selectNoteFolder(fallbackId)
      scrollToElement(`[id="${fallbackId}"]`)
    }
    else {
      clearFolderSelection()
    }
  }
}

function onRenameFolder() {
  setTimeout(() => {
    if (!contextNode.value)
      return
    editableId.value = contextNode.value.id
  }, 100)
}

function onResizeTagList(layout: number[]) {
  store.app.set(
    'sizes.notesTagsListHeight',
    normalizeTagsListHeight(layout[1]),
  )
}
</script>

<template>
  <div class="mt-1 flex items-center justify-between py-1 pl-1 select-none">
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
    >
      {{ i18n.t("sidebar.folders") }}
    </UiText>
    <UiActionButton
      :tooltip="i18n.t('action.new.folder')"
      @click="createNoteFolderAndSelect()"
    >
      <Plus class="h-4 w-4" />
    </UiActionButton>
  </div>
  <Resizable.ResizablePanelGroup
    direction="vertical"
    class="min-h-0 flex-1"
    @layout="onResizeTagList"
  >
    <Resizable.ResizablePanel>
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
              <template #icon>
                <div class="mr-1.5 flex flex-shrink-0 items-center">
                  <Folder class="h-4 w-4" />
                </div>
              </template>
            </UiTree>
          </ContextMenu.ContextMenuTrigger>
          <UiEmptyPlaceholder
            v-if="!treeData.length"
            :text="i18n.t('placeholder.emptyFoldersList')"
          />
          <ContextMenu.ContextMenuContent>
            <template v-if="isContextMultiSelection">
              <ContextMenu.ContextMenuItem @click="onDeleteFolder">
                {{ i18n.t("action.delete.common") }}
              </ContextMenu.ContextMenuItem>
            </template>
            <template v-else>
              <ContextMenu.ContextMenuItem
                @click="createNoteFolderAndSelect(contextNode?.id)"
              >
                {{ i18n.t("action.new.folder") }}
              </ContextMenu.ContextMenuItem>
              <ContextMenu.ContextMenuSeparator />
              <ContextMenu.ContextMenuItem @click="onRenameFolder">
                {{ i18n.t("action.rename") }}
              </ContextMenu.ContextMenuItem>
              <ContextMenu.ContextMenuItem @click="onDeleteFolder">
                {{ i18n.t("action.delete.common") }}
              </ContextMenu.ContextMenuItem>
            </template>
          </ContextMenu.ContextMenuContent>
        </ContextMenu.ContextMenu>
      </div>
    </Resizable.ResizablePanel>

    <Resizable.ResizableHandle />

    <Resizable.ResizablePanel
      :min-size="MIN_TAGS_PANEL_SIZE"
      :default-size="tagsListHeight"
    >
      <div class="flex h-full min-h-0 flex-col">
        <div class="flex items-center justify-between py-1 pl-1 select-none">
          <UiText
            as="div"
            variant="caption"
            weight="bold"
            uppercase
          >
            {{ i18n.t("sidebar.tags") }}
          </UiText>
        </div>

        <div class="min-h-0 flex-1 px-1 pb-1">
          <NotesSidebarTags />
        </div>
      </div>
    </Resizable.ResizablePanel>
  </Resizable.ResizablePanelGroup>
</template>
