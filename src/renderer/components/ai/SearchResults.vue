<script setup lang="ts">
import type { AiSearchResults } from '~/shared/ai'
import { i18n } from '@/electron'

defineProps<{ result: AiSearchResults }>()
</script>

<template>
  <UiDisclosure v-if="result.items.length">
    <template #title>
      {{ i18n.t("ai.searchResults.title") }} · {{ result.items.length }}
    </template>
    <ol
      v-if="result.items.length"
      class="space-y-2"
    >
      <li
        v-for="item in result.items"
        :key="`${item.type}:${item.id}`"
      >
        <AiVaultLink :item="item" />
      </li>
    </ol>
    <UiText
      v-else
      variant="xs"
      muted
      as="p"
    >
      {{ i18n.t("ai.searchResults.empty") }}
    </UiText>
    <UiText
      v-if="result.total > result.items.length"
      variant="caption"
      muted
      as="p"
    >
      {{
        i18n.t("ai.searchResults.limited", {
          shown: result.items.length,
          total: result.total,
        })
      }}
    </UiText>
    <UiText
      v-if="!result.expanded"
      variant="caption"
      muted
      as="p"
    >
      {{ i18n.t("ai.searchResults.unexpanded") }}
    </UiText>
  </UiDisclosure>
</template>
