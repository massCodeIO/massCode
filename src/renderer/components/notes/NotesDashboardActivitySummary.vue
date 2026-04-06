<script setup lang="ts">
import type { NotesDashboardResponse } from '@/services/api/generated'
import { i18n } from '@/electron'

defineProps<{
  activity: NotesDashboardResponse['activity']
}>()
</script>

<template>
  <NotesDashboardSection
    :title="i18n.t('notes.dashboard.activity.summaryTitle')"
  >
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.activity.updatedToday") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ activity.notesUpdatedToday }}
        </div>
      </div>
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.activity.updatedWeek") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ activity.notesUpdatedLast7Days }}
        </div>
      </div>
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.activity.currentStreak") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ activity.streak.current }}
        </div>
      </div>
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-muted-foreground text-xs uppercase">
          {{ i18n.t("notes.dashboard.activity.bestStreak") }}
        </div>
        <div class="mt-2 text-2xl font-semibold">
          {{ activity.streak.max }}
        </div>
      </div>
    </div>
  </NotesDashboardSection>
</template>
