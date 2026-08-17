<script setup lang="ts">
import type { TagItem } from '@/components/ui/input-tags/types'
import { useSnippets, useTags } from '@/composables'

const {
  displayedSnippet,
  selectedSnippet,
  selectedSnippetRecordStatus,
  deleteTagFromSnippet,
  addTagToSnippet,
} = useSnippets()
const { tags, addTag, getTags, isTagsLoaded } = useTags()

// Инициализация спейса уже загружает теги — не дублируем запрос на маунт.
if (!isTagsLoaded.value) {
  void getTags()
}

const snippetTags = computed(() => displayedSnippet.value?.tags || [])

function getMutationSnippetId() {
  if (
    selectedSnippetRecordStatus.value !== 'ready'
    || selectedSnippet.value?.id !== displayedSnippet.value?.id
  ) {
    return
  }

  return selectedSnippet.value.id
}

async function onCreateTag(newTag: TagItem) {
  try {
    const initialSnippetId = getMutationSnippetId()
    if (!initialSnippetId) {
      return
    }

    const id = await addTag(newTag.name)

    const snippetId = getMutationSnippetId()
    if (id && snippetId === initialSnippetId) {
      await addTagToSnippet(id, snippetId)
    }

    await getTags()
  }
  catch (error) {
    console.error('Error creating tag:', error)
  }
}

function onDeleteTag(deletedTag: TagItem) {
  const snippetId = getMutationSnippetId()
  if (snippetId) {
    deleteTagFromSnippet(deletedTag.id, snippetId)
  }
}
function onAddTag(tag: TagItem) {
  const snippetId = getMutationSnippetId()
  if (snippetId) {
    addTagToSnippet(tag.id, snippetId)
  }
}
</script>

<template>
  <UiInputTags
    :model-value="snippetTags"
    :suggestions="tags"
    class="w-full"
    @create-tag="onCreateTag"
    @delete-tag="onDeleteTag"
    @add-tag="onAddTag"
  />
</template>
