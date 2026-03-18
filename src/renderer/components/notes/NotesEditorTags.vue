<script setup lang="ts">
import type { TagItem } from '@/components/ui/input-tags/types'
import { useNotes, useNoteTags } from '@/composables'

const { selectedNote, addTagToNote, deleteTagFromNote } = useNotes()
const { tags, addNoteTag, getNoteTags } = useNoteTags()

void getNoteTags()

const noteTags = computed(() => selectedNote.value?.tags || [])

async function onCreateTag(newTag: TagItem) {
  try {
    const id = await addNoteTag(newTag.name)

    if (id && selectedNote.value) {
      await addTagToNote(id, selectedNote.value.id)
    }

    await getNoteTags()
  }
  catch (error) {
    console.error('Error creating note tag:', error)
  }
}

async function onDeleteTag(deletedTag: TagItem) {
  if (selectedNote.value) {
    await deleteTagFromNote(deletedTag.id, selectedNote.value.id)
  }
}

async function onAddTag(tag: TagItem) {
  if (selectedNote.value) {
    await addTagToNote(tag.id, selectedNote.value.id)
  }
}
</script>

<template>
  <UiInputTags
    :model-value="noteTags"
    :suggestions="tags"
    class="w-full"
    @create-tag="onCreateTag"
    @delete-tag="onDeleteTag"
    @add-tag="onAddTag"
  />
</template>
