<script setup lang="ts">
import type { AiHttpProposal } from '~/shared/aiHttp'
import { httpAssertionText } from '@/composables/ai/httpProposalText'
import { i18n } from '@/electron'

defineProps<{ proposal: AiHttpProposal, showEvidence?: boolean }>()
</script>

<template>
  <div class="space-y-2">
    <UiText
      as="p"
      variant="sm"
      weight="medium"
    >
      {{
        i18n.t("ai.http.proposedCount", { count: proposal.assertions.length })
      }}
    </UiText>
    <div
      v-for="(rule, index) in proposal.assertions"
      :key="index"
      class="space-y-1"
    >
      <UiText
        as="p"
        variant="sm"
        class="break-words whitespace-pre-wrap"
      >
        {{ httpAssertionText(rule) }}
      </UiText>
      <template v-if="showEvidence">
        <UiText
          v-for="evidence in proposal.evidence?.filter(
            (item) => item.assertionIndex === index,
          )"
          :key="evidence.assertionIndex"
          as="p"
          variant="caption"
          muted
          class="break-words whitespace-pre-wrap"
        >
          {{ i18n.t(`ai.http.evidence.${evidence.source}`) }}:
          {{ evidence.quote }}
        </UiText>
      </template>
    </div>
    <UiText
      v-if="showEvidence"
      as="p"
      variant="caption"
      muted
    >
      {{ i18n.t("ai.http.evidence.review") }}
    </UiText>
  </div>
</template>
