<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useSnippets, useTags } from '@/composables'
import { i18n } from '@/electron'

const { tags, getTags, deleteTag } = useTags()
const { highlightedTagId, state } = useApp()
const {
  getSnippets,
  selectFirstSnippet,
  clearSnippets,
  clearSearch,
  isRestoreStateBlocked,
} = useSnippets()

getTags()

const idToDelete = ref(0)

async function onTagClick(tagId: number) {
  state.tagId = tagId
  state.folderId = undefined
  state.libraryFilter = undefined

  isRestoreStateBlocked.value = true
  clearSearch()

  await getSnippets({ tagId })
  selectFirstSnippet()
}

function onClickContextMenu(tagId: number) {
  highlightedTagId.value = tagId
  idToDelete.value = tagId
}

async function onDelete() {
  const { confirm } = useDialog()

  const name = tags.value.find(
    tag => tag.id === highlightedTagId.value,
  )?.name

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.delete', { name }),
    content: i18n.t('messages:warning.deleteTag'),
  })

  if (isConfirmed && idToDelete.value) {
    await deleteTag(idToDelete.value)

    if (state.tagId === idToDelete.value) {
      state.tagId = undefined
      clearSnippets()
    }
    else if (state.tagId) {
      await getSnippets({ tagId: state.tagId })
    }

    idToDelete.value = 0
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
    :options="{ minScrollbarLength: 20, suppressScrollX: true }"
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
          {{ i18n.t("action.delete.common") }}
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </PerfectScrollbar>
  <UiEmptyPlaceholder
    v-else
    :text="i18n.t('placeholder.emptyTagList')"
  />
</template>
