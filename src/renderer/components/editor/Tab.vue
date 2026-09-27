<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useSnippets, useSnippetUpdate } from '@/composables'
import { i18n } from '@/electron'

interface Props {
  id: number
  index: number
  name: string
}

const props = defineProps<Props>()

const { selectedSnippet, selectedSnippetRecordStatus, deleteSnippetContent }
  = useSnippets()
const { addToUpdateContentQueue } = useSnippetUpdate()
const { highlightedSnippetIds, highlightedFolderIds, state } = useApp()

const tabRef = ref<HTMLDivElement>()
const isEdit = ref(false)

const name = computed({
  get() {
    return props.name
  },
  set(v: string) {
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

async function onDelete() {
  if (
    selectedSnippetRecordStatus.value !== 'ready'
    || selectedSnippet.value?.id !== state.snippetId
    || selectedSnippet.value.contents.length <= 1
  ) {
    return
  }

  await deleteSnippetContent(selectedSnippet.value!.id, props.id)

  if (state.snippetContentIndex === props.index) {
    state.snippetContentIndex = 0
  }
  else if (
    state.snippetContentIndex
    && state.snippetContentIndex > props.index
  ) {
    state.snippetContentIndex--
  }
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
          @dblclick="isEdit = true"
        >
          {{ name }}
        </UiText>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
        <ContextMenu.ContextMenuItem @click="isEdit = true">
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
    <UiInput
      v-else
      v-model="name"
      variant="ghost"
      focus
      select
      class="h-full w-full min-w-0 rounded-none px-0 py-0"
      @mousedown.stop
      @keydown.stop
      @blur="isEdit = false"
      @keydown.esc="isEdit = false"
    />
  </div>
</template>
