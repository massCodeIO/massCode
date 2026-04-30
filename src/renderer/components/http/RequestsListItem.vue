<script setup lang="ts">
import type { HttpRequestListItem } from '@/composables/spaces/http/useHttpRequests'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useHttpApp, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'

interface Props {
  request: HttpRequestListItem
}

const props = defineProps<Props>()

const { httpState } = useHttpApp()
const {
  deleteHttpRequest,
  renameRequestId,
  selectHttpRequest,
  updateHttpRequest,
} = useHttpRequests()

const isSelected = computed(() => httpState.requestId === props.request.id)
const isRenaming = computed(() => renameRequestId.value === props.request.id)

const renameValue = ref(props.request.name)

watch(isRenaming, (renaming) => {
  if (renaming) {
    renameValue.value = props.request.name
  }
})

async function onClick() {
  await selectHttpRequest(props.request.id)
}

async function commitRename() {
  const trimmed = renameValue.value.trim()
  renameRequestId.value = null
  if (trimmed && trimmed !== props.request.name) {
    await updateHttpRequest(props.request.id, { name: trimmed })
  }
}

function cancelRename() {
  renameRequestId.value = null
}

function startRename() {
  renameRequestId.value = props.request.id
}

async function onDelete() {
  await deleteHttpRequest(props.request.id)
}
</script>

<template>
  <div
    data-http-request-item
    class="border-border relative border-b px-1"
    :class="{ 'is-selected': isSelected }"
    @click="onClick"
    @dblclick="startRename"
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger as-child>
        <div class="flex items-center gap-2 px-2 py-1.5 select-none">
          <HttpMethodBadge
            :method="props.request.method"
            class="w-9 shrink-0 text-right"
          />
          <input
            v-if="isRenaming"
            v-model="renameValue"
            class="bg-background flex-1 rounded border px-1 text-sm outline-none"
            autofocus
            @click.stop
            @blur="commitRename"
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
          >
          <UiText
            v-else
            class="flex-1 truncate text-sm"
          >
            {{ props.request.name }}
          </UiText>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
        <ContextMenu.ContextMenuItem @click="startRename">
          {{ i18n.t("action.rename") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @click="onDelete">
          {{ i18n.t("action.delete.common") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuContent>
    </ContextMenu.ContextMenu>
  </div>
</template>

<style lang="scss">
@reference "../../styles.css";
[data-http-request-item] {
  &:not(.is-selected) {
    @apply hover:bg-accent-hover hover:rounded-md;
  }
  &.is-selected {
    @apply bg-accent text-accent-foreground z-10 rounded-md border-transparent;
  }
}
</style>
