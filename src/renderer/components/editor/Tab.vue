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

const { selectedSnippetContent, selectedSnippet, deleteSnippetContent }
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
    addToUpdateContentQueue(
      selectedSnippet.value!.id,
      selectedSnippetContent.value!.id,
      {
        label: v,
        language: selectedSnippetContent.value!.language,
        value: selectedSnippetContent.value!.value,
      },
    )
  },
})

function onClickContextMenu() {
  highlightedSnippetIds.value.clear()
  highlightedFolderIds.value.clear()
}

async function onDelete() {
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
    class="border-border border-r px-2 py-0.5 select-none last:border-r-0"
    @contextmenu="onClickContextMenu"
  >
    <ContextMenu.Root v-if="!isEdit">
      <ContextMenu.Trigger>
        <div
          class="truncate"
          @dblclick="isEdit = true"
        >
          {{ name }}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item @click="isEdit = true">
          {{ i18n.t("action.rename") }} "<span class="max-w-36 truncate">{{
            name
          }}</span>"
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item @click="onDelete">
          {{ i18n.t("action.delete.common") }} "<span
            class="max-w-36 truncate"
          >{{ name }}</span>"
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
    <UiInput
      v-else
      v-model="name"
      variant="ghost"
      focus
      select
      class="w-full rounded-none px-0 py-0 leading-0"
      @blur="isEdit = false"
      @keydown.esc="isEdit = false"
    />
  </div>
</template>
