<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useSnippets, useTags } from '@/composables'
import { i18n } from '@/electron'
import { Tag } from 'lucide-vue-next'

const { tags, getTags, deleteTag } = useTags()
const { selectedTagId, highlightedTagId } = useApp()
const { getSnippets, selectFirstSnippet, clearSnippets } = useSnippets()

getTags()

async function onTagClick(tagId: number) {
  selectedTagId.value = tagId
  highlightedTagId.value = undefined
  await getSnippets({ tagId })
  selectFirstSnippet()
}

function onClickContextMenu(tagId: number) {
  highlightedTagId.value = tagId
}

async function onDelete() {
  const { confirm } = useDialog()

  const name = tags.value.find(
    tag => tag.id === highlightedTagId.value,
  )?.name

  const isConfirmed = await confirm({
    title: i18n.t('dialog:deleteConfirm', { name }),
    content: i18n.t('dialog:deleteTag'),
  })

  if (isConfirmed && highlightedTagId.value) {
    await deleteTag(highlightedTagId.value)

    if (selectedTagId.value === highlightedTagId.value) {
      selectedTagId.value = undefined
      clearSnippets()
    }
    else if (selectedTagId.value) {
      await getSnippets({ tagId: selectedTagId.value })
    }
  }
}
</script>

<template>
  <PerfectScrollbar data-sidebar-library-tags>
    <div class="px-1">
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center gap-2 rounded-md px-5 select-none"
            :class="{
              'bg-list-selection text-list-selection-fg':
                selectedTagId === tag.id,
              'outline-primary bg-transparent outline-2 -outline-offset-2':
                highlightedTagId === tag.id,
            }"
            @click="onTagClick(tag.id)"
            @contextmenu="onClickContextMenu(tag.id)"
          >
            <Tag class="h-3 w-3 shrink-0" />
            <span class="truncate">{{ tag.name }}</span>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item @click="onDelete">
            {{ i18n.t("delete") }}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </div>
  </PerfectScrollbar>
</template>
