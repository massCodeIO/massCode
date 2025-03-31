<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useSnippets, useTags } from '@/composables'
import { i18n } from '@/electron'

const { tags, getTags, deleteTag } = useTags()
const { selectedTagId, highlightedTagId, selectedFolderId } = useApp()
const { getSnippets, selectFirstSnippet, clearSnippets } = useSnippets()

getTags()

async function onTagClick(tagId: number) {
  selectedTagId.value = tagId
  highlightedTagId.value = undefined
  selectedFolderId.value = undefined
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

function onUpdateContextMenu(bool: boolean) {
  if (!bool) {
    highlightedTagId.value = undefined
  }
}
</script>

<template>
  <PerfectScrollbar
    v-if="tags.length"
    data-sidebar-tags
  >
    <ContextMenu.Root @update:open="onUpdateContextMenu">
      <ContextMenu.Trigger>
        <SidebarTagsItem
          v-for="tag in tags"
          :id="tag.id"
          :key="tag.id"
          :name="tag.name"
          @click="onTagClick(tag.id)"
          @contextmenu="onClickContextMenu(tag.id)"
        />
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item @click="onDelete">
          {{ i18n.t("delete") }}
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </PerfectScrollbar>
  <div
    v-else
    class="text-text-muted flex h-full items-center justify-center text-center"
  >
    {{ i18n.t("emptyTagList") }}
  </div>
</template>
