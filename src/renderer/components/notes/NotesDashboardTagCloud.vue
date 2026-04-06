<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'

const props = defineProps<{
  tags: NotesDashboardResponse['tags']
}>()

const { openTagInNotesWorkspace } = useNotesWorkspaceNavigation()

const maxNoteCount = computed(() =>
  Math.max(1, ...props.tags.map(tag => tag.noteCount)),
)

function getFontSize(noteCount: number) {
  const min = 0.9
  const max = 1.5

  return `${min + (noteCount / maxNoteCount.value) * (max - min)}rem`
}
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.tags.title')">
    <div
      v-if="props.tags.length"
      class="flex flex-wrap gap-2"
    >
      <button
        v-for="tag in props.tags"
        :key="tag.id"
        class="bg-muted hover:bg-accent rounded-full px-3 py-1 transition-colors"
        :style="{ fontSize: getFontSize(tag.noteCount) }"
        @click="openTagInNotesWorkspace(tag.id)"
      >
        {{ tag.name }}
        <span class="text-muted-foreground ml-1 text-xs">
          {{ tag.noteCount }}
        </span>
      </button>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.tags.empty')"
    />
  </NotesDashboardSection>
</template>
