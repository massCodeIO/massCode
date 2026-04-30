<script setup lang="ts">
import type { HttpFolderTreeItem } from '@/composables/spaces/http/useHttpFolders'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useHttpApp, useHttpFolders, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { cn } from '@/utils'
import { ChevronRight, Folder } from 'lucide-vue-next'

interface Props {
  folder: HttpFolderTreeItem
  depth: number
}

const props = defineProps<Props>()

const { httpState } = useHttpApp()
const {
  createHttpFolderAndSelect,
  deleteHttpFolder,
  renameFolderId,
  selectHttpFolder,
  updateHttpFolder,
} = useHttpFolders()
const { createHttpRequestAndSelect } = useHttpRequests()

const isOpen = computed(() => Boolean(props.folder.isOpen))
const isRenaming = computed(() => renameFolderId.value === props.folder.id)
const isSelected = computed(() => httpState.folderId === props.folder.id)

const renameValue = ref(props.folder.name)

watch(isRenaming, (renaming) => {
  if (renaming) {
    renameValue.value = props.folder.name
  }
})

async function toggleOpen() {
  await updateHttpFolder(props.folder.id, { isOpen: isOpen.value ? 0 : 1 })
}

function onSelect() {
  selectHttpFolder(props.folder.id)
}

async function commitRename() {
  const trimmed = renameValue.value.trim()
  renameFolderId.value = null
  if (trimmed && trimmed !== props.folder.name) {
    await updateHttpFolder(props.folder.id, { name: trimmed })
  }
}

function cancelRename() {
  renameFolderId.value = null
}

function startRename() {
  renameFolderId.value = props.folder.id
}

async function onCreateChildFolder() {
  await createHttpFolderAndSelect(props.folder.id)
}

async function onCreateChildRequest() {
  await createHttpRequestAndSelect({ folderId: props.folder.id })
  if (!isOpen.value) {
    await updateHttpFolder(props.folder.id, { isOpen: 1 })
  }
}

async function onDelete() {
  await deleteHttpFolder(props.folder.id)
}
</script>

<template>
  <div>
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger as-child>
        <div
          :class="
            cn(
              'group flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-sm',
              isSelected
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/60',
            )
          "
          :style="{ paddingLeft: `${props.depth * 12 + 4}px` }"
          @click="onSelect"
          @dblclick="startRename"
        >
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground -ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center"
            @click.stop="toggleOpen"
          >
            <ChevronRight
              class="h-3.5 w-3.5 transition-transform"
              :class="{ 'rotate-90': isOpen }"
            />
          </button>
          <Folder class="h-4 w-4 shrink-0" />
          <input
            v-if="isRenaming"
            v-model="renameValue"
            class="bg-background ml-1 flex-1 rounded border px-1 text-sm outline-none"
            autofocus
            @click.stop
            @blur="commitRename"
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
          >
          <UiText
            v-else
            class="ml-1 flex-1 truncate text-sm"
          >
            {{ props.folder.name }}
          </UiText>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
        <ContextMenu.ContextMenuItem @click="onCreateChildRequest">
          {{ i18n.t("spaces.http.action.newRequest") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem @click="onCreateChildFolder">
          {{ i18n.t("action.new.folder") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @click="startRename">
          {{ i18n.t("action.rename") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @click="onDelete">
          {{ i18n.t("action.delete.common") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuContent>
    </ContextMenu.ContextMenu>
    <div v-if="isOpen">
      <HttpSidebarFolderItem
        v-for="child in props.folder.children"
        :key="child.id"
        :folder="child"
        :depth="props.depth + 1"
      />
    </div>
  </div>
</template>
