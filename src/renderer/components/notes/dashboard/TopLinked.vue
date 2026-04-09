<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import * as Card from '@/components/ui/shadcn/card'
import { useNotesWorkspaceNavigation } from '@/composables'
import { i18n } from '@/electron'

const props = defineProps<{
  topLinked: NotesDashboardResponse['topLinked']
}>()

const { openNoteInNotesWorkspace } = useNotesWorkspaceNavigation()
</script>

<template>
  <Card.Card class="h-full">
    <Card.CardHeader class="border-b">
      <Card.CardTitle>
        {{ i18n.t("notes.dashboard.topLinked.title") }}
      </Card.CardTitle>
    </Card.CardHeader>
    <Card.CardContent class="min-h-0 flex-1">
      <div
        v-if="props.topLinked.length"
        class="flex flex-col gap-2"
      >
        <button
          v-for="note in props.topLinked"
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
            class="mt-1"
          >
            {{
              i18n.t("notes.dashboard.topLinked.incoming", {
                count: note.incomingLinksCount,
              })
            }}
          </UiText>
        </button>
      </div>
      <UiEmptyPlaceholder
        v-else
        :text="i18n.t('notes.dashboard.topLinked.empty')"
      />
    </Card.CardContent>
  </Card.Card>
</template>
