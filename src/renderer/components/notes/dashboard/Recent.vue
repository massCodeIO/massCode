<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'

const props = defineProps<{
  recent: NotesDashboardResponse['recent']
}>()

const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
})
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.recent.title')">
    <div
      v-if="props.recent.length"
      class="flex flex-col gap-2"
    >
      <button
        v-for="note in props.recent"
        :key="note.id"
        class="hover:bg-accent-hover rounded-lg px-3 py-2 text-left transition-colors"
        @click="openNoteInNotesWorkspace(note.id)"
      >
        <UiText
          as="div"
          variant="base"
          weight="medium"
          class="truncate"
        >
          {{ note.name }}
        </UiText>
        <UiText
          as="div"
          variant="xs"
          muted
          class="mt-1 flex items-center gap-2"
        >
          <span>{{ note.folder?.name || i18n.t("common.inbox") }}</span>
          <span>•</span>
          <span>{{ dateFormatter.format(note.updatedAt) }}</span>
        </UiText>
      </button>
    </div>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('notes.dashboard.recent.empty')"
    />
  </NotesDashboardSection>
</template>
