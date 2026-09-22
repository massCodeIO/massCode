<script setup lang="ts">
import type { AiHttpProposal } from '~/shared/aiHttp'
import { i18n } from '@/electron'
import { ChevronRight } from 'lucide-vue-next'

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
  <details
    v-else
    class="group min-w-0 rounded-md border"
  >
    <summary
      class="focus-visible:outline-ring flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 focus-visible:outline-2 [&::-webkit-details-marker]:hidden"
    >
      <ChevronRight
        class="text-muted-foreground size-3.5 shrink-0 group-open:rotate-90"
        aria-hidden="true"
      />
      <UiText
        variant="sm"
        weight="medium"
      >
        {{
          i18n.t("ai.http.proposedCount", { count: proposal.assertions.length })
        }}
      </UiText>
    </summary>
    <div class="border-t">
      <AiHttpChecksTable :proposal="proposal" />
    </div>
  </details>
</template>
