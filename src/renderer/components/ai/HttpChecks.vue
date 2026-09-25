<script setup lang="ts">
import type { AiHttpProposal } from '~/shared/aiHttp'
import { i18n } from '@/electron'

defineProps<{ proposal: AiHttpProposal, showEvidence?: boolean }>()
</script>

<template>
  <div
    v-if="showEvidence"
    class="space-y-3"
  >
    <UiText
      as="p"
      variant="sm"
      weight="medium"
    >
      {{
        i18n.t("ai.http.proposedCount", { count: proposal.assertions.length })
      }}
    </UiText>
    <UiText
      as="p"
      variant="xs"
      muted
    >
      {{ i18n.t("ai.http.evidence.review") }}
    </UiText>
    <AiHttpChecksTable
      :proposal="proposal"
      show-evidence
    />
  </div>
  <UiDisclosure
    v-else
    content-class="p-0"
  >
    <template #title>
      {{
        i18n.t("ai.http.proposedCount", { count: proposal.assertions.length })
      }}
    </template>
    <AiHttpChecksTable :proposal="proposal" />
  </UiDisclosure>
</template>
