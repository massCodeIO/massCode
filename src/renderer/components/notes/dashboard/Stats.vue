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
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.notes") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.notesCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.words") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.wordsCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.folders") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.foldersCount) }}
        </UiText>
      </div>
      <div class="rounded-lg p-4">
        <UiText
          as="div"
          variant="xs"
          muted
          uppercase
        >
          {{ i18n.t("notes.dashboard.stats.tags") }}
        </UiText>
        <UiText
          as="div"
          weight="semibold"
          class="mt-2 text-2xl leading-none"
        >
          {{ numberFormatter.format(stats.tagsCount) }}
        </UiText>
      </div>
    </div>
  </NotesDashboardSection>
</template>
