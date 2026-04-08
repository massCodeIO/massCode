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
    <div class="grid h-full grid-cols-2 grid-rows-2 gap-3">
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.activity.updatedToday") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ activity.notesUpdatedToday }}
        </UiText>
      </div>
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.activity.updatedWeek") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ activity.notesUpdatedLast7Days }}
        </UiText>
      </div>
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.activity.currentStreak") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ activity.streak.current }}
        </UiText>
      </div>
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.activity.bestStreak") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ activity.streak.max }}
        </UiText>
      </div>
    </div>
  </NotesDashboardSection>
</template>
