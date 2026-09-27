<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useApp,
  useDialog,
  useSnippets,
  useSnippetUpdate,
} from '@/composables'
import { i18n } from '@/electron'

interface Props {
  id: number
  index: number
  name: string
}

const props = defineProps<Props>()

const { selectedSnippet, selectedSnippetRecordStatus, deleteSnippetContent }
  = useSnippets()
const { addToUpdateContentQueue, isContentUpdateBusy } = useSnippetUpdate()
const { confirm } = useDialog()
const { highlightedSnippetIds, highlightedFolderIds, state } = useApp()

const tabRef = ref<HTMLDivElement>()
const isEdit = ref(false)
const editName = ref('')
const pendingName = ref<string>()
let renameRequested = false

watch(
  () => {
    const snippetId = selectedSnippet.value?.id
    return snippetId !== undefined && isContentUpdateBusy(snippetId, props.id)
  },
  (busy) => {
    if (!busy)
      pendingName.value = undefined
  },
)

const name = computed({
  get() {
    return isEdit.value ? editName.value : (pendingName.value ?? props.name)
  },
  set(v: string) {
    editName.value = v
    const content = selectedSnippet.value?.contents.find(
      content => content.id === props.id,
    )

    // value === undefined: тело фрагмента ещё не загружено, переименование
    // отправило бы пустой контент.
    if (
      selectedSnippetRecordStatus.value !== 'ready'
      || selectedSnippet.value?.id !== state.snippetId
      || !content
      || content.value === undefined
    ) {
      return
    }

    pendingName.value = v
    addToUpdateContentQueue(selectedSnippet.value.id, content.id, {
      label: v,
      language: content.language,
      value: content.value,
    })
  },
})

function onClickContextMenu() {
  highlightedSnippetIds.value.clear()
  highlightedFolderIds.value.clear()
}

function startEdit() {
  editName.value = name.value
  isEdit.value = true
}

function onMenuCloseAutoFocus(event: Event) {
  if (!renameRequested)
    return

  event.preventDefault()
  renameRequested = false
  startEdit()
}

async function onDelete() {
  if (
    selectedSnippetRecordStatus.value !== 'ready'
    || selectedSnippet.value?.id !== state.snippetId
    || selectedSnippet.value.contents.length <= 1
  ) {
    return
  }

  const snippetId = selectedSnippet.value.id
  const contentId = props.id
  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.deletePermanently', {
      name: name.value,
    }),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (isConfirmed)
    await deleteSnippetContent(snippetId, contentId)
}
</script>

<template>
  <div
    ref="tabRef"
    data-editor-tab
    class="min-w-0 cursor-default select-none"
    @contextmenu="onClickContextMenu"
  >
    <ContextMenu.ContextMenu v-if="!isEdit">
      <ContextMenu.ContextMenuTrigger class="block w-full min-w-0">
        <UiText
          as="span"
          variant="base"
          weight="medium"
          class="block truncate text-center leading-5 text-inherit"
          :title="name"
          @dblclick="startEdit"
        >
          {{ name }}
        </UiText>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent @close-auto-focus="onMenuCloseAutoFocus">
        <ContextMenu.ContextMenuItem @select="renameRequested = true">
          <span class="inline-flex min-w-0 items-center">
            {{ i18n.t("action.rename") }} "<span class="max-w-36 truncate">{{
              name
            }}</span>"
          </span>
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem
          :disabled="(selectedSnippet?.contents.length ?? 0) <= 1"
          @click="onDelete"
        >
          <span class="inline-flex min-w-0 items-center">
            {{ i18n.t("action.delete.common") }} "<span
              class="max-w-36 truncate"
            >{{ name }}</span>"
          </span>
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuContent>
    </ContextMenu.ContextMenu>
    <div
      v-else
      class="relative w-full min-w-0"
    >
      <UiText
        as="span"
        variant="base"
        weight="medium"
        aria-hidden="true"
        class="invisible block truncate pr-1 text-center leading-5 whitespace-pre"
      >
        {{ name }}
      </UiText>
      <div class="absolute inset-0 min-w-0">
        <UiInput
          v-model="name"
          variant="ghost"
          focus
          select
          class="h-5 w-full min-w-0 rounded-none px-0 py-0 text-sm font-medium"
          @mousedown.stop
          @keydown.stop
          @blur="isEdit = false"
          @keydown.enter.prevent="isEdit = false"
          @keydown.esc="isEdit = false"
        />
      </div>
    </div>
  </div>
</template>
