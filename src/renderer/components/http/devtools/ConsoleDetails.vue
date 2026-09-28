<script setup lang="ts">
import type { HttpConsoleEntry } from '~/shared/httpDevtools'
import { i18n } from '@/electron'

const props = defineProps<{ entry: HttpConsoleEntry, raw: boolean }>()
const sections = computed(() =>
  Object.entries(props.entry.details ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      label: i18n.t(`spaces.http.devtools.details.${key}`, {
        defaultValue: key,
      }),
      value,
    })),
)
</script>

<template>
  <div class="scrollbar min-h-0 overflow-auto px-3 pb-2">
    <UiText
      v-if="raw"
      as="pre"
      variant="xs"
      mono
      class="select-text"
    >
      {{ JSON.stringify(entry, null, 2) }}
    </UiText>
    <template v-else>
      <UiJsonTree
        v-for="section in sections"
        :key="`${entry.id}:${section.key}`"
        :label="section.label"
        :value="section.value"
      />
    </template>
  </div>
</template>
