<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { i18n } from '@/electron'

defineProps<{
  stats: NotesDashboardResponse['stats']
}>()

const numberFormatter = new Intl.NumberFormat()
</script>

<template>
  <NotesDashboardSection :title="i18n.t('notes.dashboard.stats.title')">
    <div class="grid h-full grid-cols-2 grid-rows-2 gap-3">
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.stats.notes") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ numberFormatter.format(stats.notesCount) }}
        </div>
      </div>
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.stats.words") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ numberFormatter.format(stats.wordsCount) }}
        </div>
      </div>
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.stats.folders") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ numberFormatter.format(stats.foldersCount) }}
        </div>
      </div>
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.stats.tags") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ numberFormatter.format(stats.tagsCount) }}
        </div>
      </div>
    </div>
  </NotesDashboardSection>
</template>
