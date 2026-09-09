<script setup lang="ts">
import { useHttpCollection } from '@/composables/spaces/http/useHttpCollection'
import { i18n } from '@/electron'

const { collection, draft, saving, unavailable } = useHttpCollection()
const editing = ref(false)
const editor = ref<{ focusEditor: () => void }>()
async function startEditing() {
  if (saving.value || unavailable.value)
    return
  editing.value = true
  await nextTick()
  editor.value?.focusEditor()
}
function onEscape(event: KeyboardEvent) {
  if (!editing.value || draft.value.documentation.trim())
    return
  event.preventDefault()
  event.stopPropagation()
  editing.value = false
}
const showGuide = computed(
  () => !draft.value.documentation.trim() && !editing.value,
)
watch(
  () => collection.value?.id,
  () => {
    editing.value = false
  },
)
</script>

<template>
  <div
    v-if="collection"
    class="flex h-full min-h-0 flex-col"
    @keydown.esc.capture="onEscape"
  >
    <div
      v-if="showGuide"
      class="min-h-0 flex-1"
      role="button"
      :tabindex="saving || unavailable ? -1 : 0"
      :aria-disabled="saving || unavailable"
      :aria-label="i18n.t('spaces.http.collection.dashboard.editDescription')"
      @click.capture="startEditing"
      @keydown.enter.self.prevent="startEditing"
      @keydown.space.self.prevent="startEditing"
    >
      <NotesEditor
        :content="i18n.t('spaces.http.collection.dashboard.descriptionGuide')"
        mode="preview"
        disabled
      />
    </div>
    <NotesEditor
      v-else
      ref="editor"
      :key="collection.id"
      v-model:content="draft.documentation"
      :disabled="saving || unavailable"
    />
  </div>
</template>
