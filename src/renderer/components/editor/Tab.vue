<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useSnippets, useSnippetUpdate } from '@/composables'

interface Props {
  name: string
}

const props = defineProps<Props>()

const { selectedSnippetContent, selectedSnippet } = useSnippets()
const { addToUpdateContentQueue } = useSnippetUpdate()
const { highlightedSnippetId, highlightedFolderId } = useApp()

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
  highlightedSnippetId.value = undefined
  highlightedFolderId.value = undefined
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
          Rename "<span class="max-w-36 truncate">{{ name }}</span>"
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item>
          Delete "<span class="max-w-36 truncate">{{ name }}</span>"
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
