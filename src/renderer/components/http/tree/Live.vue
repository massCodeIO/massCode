<script setup lang="ts">
import type { DropPosition, TreeNode } from '@/components/ui/tree/types'
import type { HttpTreeNode } from './types'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useDeleteShortcut,
  useHttpApp,
  useHttpFolders,
  useHttpRequests,
} from '@/composables'
import { useHttpNavigationTree } from '@/composables/spaces/http/useHttpNavigationTree'
import { i18n } from '@/electron'
import {
  getEntryNameConflictMessage,
  getEntryNameValidationMessage,
} from '@/utils'
import { CloudDownload, Folder, Layers, Star } from 'lucide-vue-next'
import { folderKey, requestKey, sidebarNodes, UNFILED_ID } from './liveModel'
import { selectRange, visibleRows } from './model'

const props = withDefaults(
  defineProps<{ query?: string, trash?: boolean, favorites?: boolean }>(),
  { query: '' },
)
const unfiledOpen = defineModel<boolean>('unfiledOpen', { default: true })
const {
  httpState,
  focusedFolderId,
  focusedRequestId,
  highlightedFolderIds,
  highlightedRequestIds,
} = useHttpApp()
const {
  folders,
  getFolderByIdFromTree,
  selectedFolderIds,
  updateHttpFolder,
  deleteSelectedHttpFolders,
  renameFolderId,
} = useHttpFolders()
const {
  requests,
  allRequests,
  trashRequests,
  currentRequest,
  isCurrentRequestDirty,
  selectedRequestIds,
  updateHttpRequest,
  deleteSelectedHttpRequests,
} = useHttpRequests()
const { nodes, open, move, validateMove, refresh, loadError, busy }
  = useHttpNavigationTree()
if (!props.trash)
  watch(requests, refresh, { immediate: true })
const treeRef = ref<{ scrollToId: (id: string | number) => void }>()
const editableId = ref<string | number | null>(null)
const anchor = ref<string>()
const contextNode = ref<HttpTreeNode>()
const source = computed(() =>
  sidebarNodes(nodes.value, {
    trash: props.trash,
    favorites: props.favorites,
    unfiledLabel: i18n.t('spaces.http.sidebar.unfiled'),
  }),
)
const nodeById = computed(
  () => new Map(source.value.map(node => [node.id, node])),
)
const contextFolder = computed(() =>
  contextNode.value?.kind !== 'request'
    ? getFolderByIdFromTree(folders.value, contextNode.value?.entityId ?? null)
    : undefined,
)
const contextRequest = computed(() =>
  [...allRequests.value, ...trashRequests.value].find(
    request =>
      contextNode.value?.kind === 'request'
      && request.id === contextNode.value.entityId,
  ),
)
const expanded = computed(
  () =>
    new Set(
      nodes.value
        .filter(
          node =>
            node.kind !== 'request'
            && getFolderByIdFromTree(folders.value, node.entityId!)?.isOpen,
        )
        .map(node => node.id),
    ),
)

const rows = computed(() =>
  visibleRows(
    source.value,
    new Set([
      ...expanded.value,
      ...(unfiledOpen.value ? [UNFILED_ID] : []),
      ...(props.favorites ? source.value.map(node => node.id) : []),
    ]),
    props.query,
  ),
)
const treeData = computed(() => {
  const matches = new Set(rows.value.map(row => row.node.id))
  const entries = new Map<string, TreeNode>()
  source.value.forEach((node) => {
    if (props.query.trim() && !matches.has(node.id))
      return
    entries.set(node.id, {
      id: node.id,
      label: node.name,
      ...(node.kind !== 'request' && {
        children: [],
        isExpanded:
          Boolean(props.query.trim())
          || props.favorites
          || (node.id === UNFILED_ID
            ? unfiledOpen.value
            : expanded.value.has(node.id)),
      }),
    })
  })
  const roots: TreeNode[] = []
  source.value.forEach((node) => {
    const entry = entries.get(node.id)
    if (!entry)
      return
    const parent = node.parentId ? entries.get(node.parentId) : undefined
    if (parent?.children)
      parent.children.push(entry)
    else if (node.parentId === null)
      roots.push(entry)
  })
  return roots
})
const activeId = computed(() =>
  ['environments', 'runner'].includes(httpState.activePanel ?? '')
    ? undefined
    : httpState.activePanel === 'folder'
      ? httpState.folderId !== undefined
        ? folderKey(httpState.folderId)
        : undefined
      : httpState.requestId !== undefined
        ? requestKey(httpState.requestId)
        : undefined,
)
const selection = ref<(string | number)[]>(
  activeId.value ? [activeId.value] : [],
)
const selectedIds = computed({
  get: () => selection.value,
  set: (ids: (string | number)[]) => {
    selection.value = ids
    selectedFolderIds.value = ids
      .map(id => nodeById.value.get(String(id)))
      .filter(
        node =>
          node && node.kind !== 'request' && node.entityId !== undefined,
      )
      .map(node => node!.entityId!)
    selectedRequestIds.value = ids
      .map(id => nodeById.value.get(String(id)))
      .filter(node => node?.kind === 'request')
      .map(node => node!.entityId!)
  },
})
const virtualFocus = ref(false)
const focusedId = computed({
  get: () =>
    virtualFocus.value
      ? UNFILED_ID
      : focusedRequestId.value !== undefined
        ? requestKey(focusedRequestId.value)
        : focusedFolderId.value !== undefined
          ? folderKey(focusedFolderId.value)
          : undefined,
  set: (id: string | number | undefined) => {
    virtualFocus.value = id === UNFILED_ID
    const node = nodeById.value.get(String(id))
    focusedFolderId.value
      = node?.kind !== 'request' ? node?.entityId : undefined
    focusedRequestId.value
      = node?.kind === 'request' ? node.entityId : undefined
  },
})
const highlightedIds = ref<Set<string | number>>(new Set())
watch(
  highlightedIds,
  (ids) => {
    highlightedFolderIds.value = new Set(
      [...ids]
        .filter(id => String(id).startsWith('folder:'))
        .map(id => Number(String(id).split(':')[1])),
    )
    highlightedRequestIds.value = new Set(
      [...ids]
        .filter(id => String(id).startsWith('request:'))
        .map(id => Number(String(id).split(':')[1])),
    )
  },
  { deep: true, flush: 'sync' },
)
function canDrag(node: TreeNode) {
  return (
    !props.trash
    && node.id !== UNFILED_ID
    && !busy.value
    && !nodeById.value.get(String(node.id))?.pending
    && !props.query.trim()
    && !props.favorites
  )
}
function contextMenu({ node }: { node: TreeNode }) {
  if (node.id === UNFILED_ID) {
    contextNode.value = undefined
    return
  }
  contextNode.value = nodeById.value.get(String(node.id))
}
function drag({
  nodes: items,
  target: node,
  position,
}: {
  nodes: TreeNode[]
  target: TreeNode
  position: DropPosition
}) {
  void move(
    items.map(node => String(node.id)),
    target(position, node),
  )
}

async function click({ node, event }: { node: TreeNode, event?: MouseEvent }) {
  const item = nodeById.value.get(String(node.id))
  if (!item)
    return
  if (item.id === UNFILED_ID) {
    unfiledOpen.value = !unfiledOpen.value
    return
  }
  if (event?.shiftKey) {
    selectedIds.value = selectRange(rows.value, anchor.value, item.id)
    return
  }
  if (event?.metaKey || event?.ctrlKey) {
    selectedIds.value = selectedIds.value.includes(item.id)
      ? selectedIds.value.filter(id => id !== item.id)
      : [...selectedIds.value, item.id]
    anchor.value = item.id
    return
  }
  highlightedIds.value = new Set()
  anchor.value = item.id
  await open(item)
  if (
    item.kind !== 'request'
    && httpState.activePanel === 'folder'
    && httpState.folderId === item.entityId
  ) {
    selectedIds.value = [item.id]
  }
  else if (
    (httpState.activePanel === undefined
      || httpState.activePanel === 'request')
    && httpState.requestId === item.entityId
  ) {
    selectedIds.value = [item.id]
  }
}
function rename(node: TreeNode) {
  if (props.trash || node.id === UNFILED_ID)
    return
  if (!nodeById.value.get(String(node.id))?.pending)
    editableId.value = node.id
}
function toggle(node: TreeNode) {
  if (node.id === UNFILED_ID) {
    unfiledOpen.value = !unfiledOpen.value
    return
  }
  if (props.query.trim())
    return
  const item = nodeById.value.get(String(node.id))
  if (item?.entityId !== undefined) {
    void updateHttpFolder(item.entityId, {
      isOpen: expanded.value.has(item.id) ? 0 : 1,
    })
  }
}
function validation(node: TreeNode, value: string) {
  const invalid = getEntryNameValidationMessage(value, i18n.t.bind(i18n))
  if (invalid)
    return invalid
  const current = nodeById.value.get(String(node.id))
  return nodes.value.some(
    node =>
      node.id !== current?.id
      && node.parentId === current?.parentId
      && node.name.toLowerCase() === value.trim().toLowerCase(),
  )
    ? getEntryNameConflictMessage(
        current?.kind === 'request' ? 'request' : 'folder',
        i18n.t.bind(i18n),
      )
    : ''
}
async function updateLabel({ node, value }: { node: TreeNode, value: string }) {
  const item = nodeById.value.get(String(node.id))
  if (!item || item.entityId === undefined)
    return
  if (item.kind === 'request') {
    if (!(await updateHttpRequest(item.entityId, { name: value.trim() })))
      return
  }
  else {
    if (!(await updateHttpFolder(item.entityId, { name: value.trim() })))
      return
  }
  editableId.value = null
}
function target(position: DropPosition, node: TreeNode) {
  return {
    id: String(node.id),
    position: position === 'center' ? ('inside' as const) : position,
  }
}
function canDrop(items: TreeNode[], node: TreeNode, position: DropPosition) {
  return (
    !props.trash
    && !props.query.trim()
    && !props.favorites
    && !validateMove(
      items.map(node => String(node.id)),
      target(position, node),
    )
  )
}
async function remove() {
  const items = selectedIds.value.map(id => nodeById.value.get(String(id)))
  const folderIds = items
    .filter(
      node => node && node.kind !== 'request' && node.entityId !== undefined,
    )
    .map(node => node!.entityId!)
  const requestIds = items
    .filter(node => node?.kind === 'request')
    .map(node => node!.entityId!)
  if (folderIds.length) {
    selectedFolderIds.value = folderIds
    await deleteSelectedHttpFolders()
  }
  if (requestIds.length) {
    selectedRequestIds.value = requestIds
    await deleteSelectedHttpRequests()
  }
}

useDeleteShortcut({
  rootSelector: props.trash
    ? '[data-http-navigation-tree=trash]'
    : '[data-http-navigation-tree=collections]',
  isEnabled: () =>
    focusedId.value !== undefined
    && nodeById.value.has(String(focusedId.value))
    && editableId.value === null,
  onDelete: remove,
})

watch(
  () => currentRequest.value?.id,
  async () => {
    const folderId = currentRequest.value?.folderId
    if (
      (httpState.activePanel === undefined
        || httpState.activePanel === 'request')
      && folderId != null
      && !props.favorites
    ) {
      const folder = getFolderByIdFromTree(folders.value, folderId)
      if (folder && !folder.isOpen)
        await updateHttpFolder(folderId, { isOpen: 1 })
    }
  },
  { immediate: true },
)
watch(renameFolderId, (id) => {
  if (id !== null) {
    editableId.value = folderKey(id)
    renameFolderId.value = null
  }
})
watch(
  [
    activeId,
    () => activeId.value !== undefined && nodeById.value.has(activeId.value),
  ],
  ([id, available]) => {
    virtualFocus.value = false
    selection.value = id && available ? [id] : []
  },
  { immediate: true },
)
watch(
  [activeId, treeData],
  () => {
    const id = activeId.value
    if (id) {
      nextTick(() => treeRef.value?.scrollToId(id))
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col"
    :data-http-navigation-tree="trash ? 'trash' : 'collections'"
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger as-child>
        <UiTree
          ref="treeRef"
          v-model:selected-ids="selectedIds"
          v-model:focused-id="focusedId"
          v-model:highlighted-ids="highlightedIds"
          v-model:editable-id="editableId"
          virtual
          :model-value="treeData"
          :get-validation-message="validation"
          :can-drop="canDrop"
          :can-drag="canDrag"
          class="h-full px-0.5 pb-1"
          @click-node="click"
          @dblclick-node="rename"
          @toggle-node="toggle"
          @context-menu="contextMenu"
          @update-label="updateLabel"
          @cancel-edit="editableId = null"
          @drag-node="drag"
        >
          <template #icon="{ node }">
            <div
              class="mr-1.5 flex shrink-0 items-center"
              :title="nodeById.get(String(node.id))?.url"
            >
              <template
                v-if="nodeById.get(String(node.id))?.kind === 'request'"
              >
                <HttpMethodBadge
                  :method="nodeById.get(String(node.id))?.method || 'GET'"
                  :protocol="nodeById.get(String(node.id))?.protocol"
                  compact
                  class="w-8 text-left"
                />
                <CloudDownload
                  v-if="nodeById.get(String(node.id))?.pending"
                  class="ml-1 size-3.5"
                />
                <Star
                  v-else-if="nodeById.get(String(node.id))?.favorite"
                  class="ml-1 size-3"
                />
                <span
                  v-if="
                    currentRequest?.id
                      === nodeById.get(String(node.id))?.entityId
                      && isCurrentRequestDirty
                  "
                  class="ml-1 size-1 rounded-full bg-current"
                />
              </template>
              <UiFolderIcon
                v-else-if="nodeById.get(String(node.id))?.icon"
                :folder-id="nodeById.get(String(node.id))!.entityId!"
                :name="nodeById.get(String(node.id))!.icon!"
                space-id="http"
              />
              <Layers
                v-else-if="nodeById.get(String(node.id))?.kind === 'collection'"
                class="size-4"
              />
              <Folder
                v-else
                class="size-4"
              />
            </div>
          </template>
        </UiTree>
      </ContextMenu.ContextMenuTrigger>
      <HttpSidebarFolderContextMenu
        v-if="contextFolder"
        :context-node="contextFolder"
        :editable-id="editableId"
        @update:editable-id="editableId = folderKey(Number($event))"
      />
      <HttpRequestContextMenu
        v-else-if="contextRequest"
        :request="contextRequest"
      >
        <ContextMenu.ContextMenuItem
          :disabled="contextRequest.pendingCloudDownload"
          @click="editableId = requestKey(contextRequest.id)"
        >
          {{ i18n.t("action.rename") }}
        </ContextMenu.ContextMenuItem>
      </HttpRequestContextMenu>
    </ContextMenu.ContextMenu>
    <UiEmptyPlaceholder
      v-if="!treeData.length && !loadError"
      :text="i18n.t('spaces.http.tree.empty')"
    />
    <UiText
      v-if="loadError"
      as="p"
      variant="sm"
      class="text-destructive p-2"
      @click="refresh"
    >
      {{ i18n.t("spaces.http.tree.loadFailed") }}
    </UiText>
  </div>
</template>
