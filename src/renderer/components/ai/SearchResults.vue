<script setup lang="ts">
import type { AiSearchResults } from '~/shared/ai'
import { i18n } from '@/electron'

defineProps<{ result: AiSearchResults }>()
</script>

<template>
  <details
    v-if="result.items.length"
    class="bg-muted/40 space-y-2 rounded-lg border p-3"
  >
    <summary class="cursor-pointer">
      <UiText
        variant="xs"
        weight="medium"
      >
        {{ i18n.t("ai.searchResults.title") }} · {{ result.items.length }}
      </UiText>
    </summary>
    <ol
      v-if="result.items.length"
      class="space-y-2"
    >
      <li
        v-for="item in result.items"
        :key="`${item.type}:${item.id}`"
      >
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <AiVaultLink :item="item" />
          <UiText
            variant="caption"
            muted
          >
            {{ i18n.t(`ai.itemTypes.${item.type}`) }}
          </UiText>
        </div>
        <UiText
          v-if="item.url"
          variant="caption"
          as="p"
          class="mt-1 font-mono break-all select-text"
        >
          {{ item.method }} {{ item.url }}
        </UiText>
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
  </details>
</template>
