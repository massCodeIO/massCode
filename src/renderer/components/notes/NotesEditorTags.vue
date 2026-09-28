<script setup lang="ts">
import type { TagItem } from '@/components/ui/input-tags/types'
import type { SelectedNoteView } from '@/composables/spaces/notes/useNotes'
import { useNotes, useNoteTags } from '@/composables'

interface Props {
  disabled?: boolean
  note?: SelectedNoteView
}

const props = defineProps<Props>()
const {
  selectedNote,
  selectedNoteRecordStatus,
  addTagToNote,
  deleteTagFromNote,
} = useNotes()
const { tags, addNoteTag, getNoteTags, isNoteTagsLoaded } = useNoteTags()

// Инициализация спейса уже загружает теги — не дублируем запрос на маунт.
if (!isNoteTagsLoaded.value) {
  void getNoteTags()
}

const noteTags = computed(() => props.note?.tags || [])
const canMutate = computed(
  () =>
    !props.disabled
    && selectedNoteRecordStatus.value === 'ready'
    && selectedNote.value?.id === props.note?.id,
)

async function onCreateTag(newTag: TagItem) {
  const noteId = canMutate.value ? props.note?.id : undefined

  try {
    const id = await addNoteTag(newTag.name)

    if (
      id
      && noteId !== undefined
      && canMutate.value
      && selectedNote.value?.id === noteId
      && props.note?.id === noteId
    ) {
      await addTagToNote(id, noteId)
    }

    await getNoteTags()
  }
  catch (error) {
    console.error('Error creating note tag:', error)
  }
}

async function onDeleteTag(deletedTag: TagItem) {
  if (canMutate.value && selectedNote.value) {
    await deleteTagFromNote(deletedTag.id, selectedNote.value.id)
  }
}

async function onAddTag(tag: TagItem) {
  if (canMutate.value && selectedNote.value) {
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
