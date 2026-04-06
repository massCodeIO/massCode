<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'

const props = defineProps<{
  topLinked: NotesDashboardResponse['topLinked']
}>()

const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.topLinked.title')">
    <div
      v-if="props.topLinked.length"
      class="flex flex-col gap-2"
    >
      <button
        v-for="note in props.topLinked"
        :key="note.id"
        class="hover:bg-accent rounded-lg px-3 py-2 text-left transition-colors"
        @click="openNoteInNotesWorkspace(note.id)"
      >
        <div class="truncate text-sm font-medium">
          {{ note.name }}
        </div>
        <div class="text-muted-foreground mt-1 text-xs">
          {{
            i18n.t("notes.dashboard.topLinked.incoming", {
              count: note.incomingLinksCount,
            })
          }}
        </div>
      </button>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.topLinked.empty')"
    />
  </NotesDashboardSection>
</template>
