<script setup lang="ts">
import type { HttpImportPreviewResponse } from '@/services/api/generated'
import { i18n } from '@/electron'

const props = defineProps<{
  collections: HttpImportPreviewResponse['collections']
}>()
const rows = computed(() =>
  props.collections.flatMap(collection =>
    (collection.runtime ?? []).map(request => ({
      ...request,
      collection: collection.name,
    })),
  ),
)
</script>

<template>
  <div
    v-if="rows.length"
    class="space-y-2"
  >
    <UiText
      as="div"
      variant="xs"
      weight="medium"
    >
      {{ i18n.t("spaces.http.import.runtimeTitle") }}
    </UiText>
    <div
      class="border-border scrollbar max-h-40 space-y-2 overflow-y-auto rounded-md border p-3"
    >
      <div
        v-for="(row, index) in rows"
        :key="index"
        class="space-y-1"
      >
        <UiText
          as="div"
          variant="xs"
          class="truncate"
        >
          {{ row.collection }} / {{ row.name }}
        </UiText>
        <UiText
          as="div"
          variant="xs"
          muted
          :class="row.scripts === 'blocked' ? 'text-warning' : ''"
        >
          {{
            i18n.t("spaces.http.import.runtimeMeta", {
              assertions: row.assertions,
              scripts: i18n.t(`spaces.http.import.scriptStates.${row.scripts}`),
            })
          }}
        </UiText>
      </div>
    </div>
    <UiText
      as="p"
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.import.scriptTrustNotice") }}
    </UiText>
  </div>
</template>
