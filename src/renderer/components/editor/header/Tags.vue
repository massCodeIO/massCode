<script setup lang="ts">
import type { TagItem } from '@/components/ui/input-tags/types'
import { useSnippets, useTags } from '@/composables'

const { selectedSnippet, deleteTagFromSnippet, addTagToSnippet }
  = useSnippets()
const { tags, addTag, getTags } = useTags()

getTags()

const snippetTags = computed(() => selectedSnippet.value?.tags || [])

async function onCreateTag(newTag: TagItem) {
  try {
    const id = await addTag(newTag.name)

    if (id && selectedSnippet.value) {
      await addTagToSnippet(id, selectedSnippet.value.id)
    }

    await getTags()
  }
  catch (error) {
    console.error('Error creating tag:', error)
  }
}

function onDeleteTag(deletedTag: TagItem) {
  if (selectedSnippet.value) {
    deleteTagFromSnippet(deletedTag.id, selectedSnippet.value.id)
  }
}
function onAddTag(tag: TagItem) {
  if (selectedSnippet.value) {
    addTagToSnippet(tag.id, selectedSnippet.value.id)
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
