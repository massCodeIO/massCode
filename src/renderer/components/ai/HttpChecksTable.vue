<script setup lang="ts">
import type { AiHttpProposal } from '~/shared/aiHttp'
import { i18n } from '@/electron'
import { httpOperatorNeedsExpected } from '~/shared/httpRuntime'

const props = defineProps<{
  proposal: AiHttpProposal
  showEvidence?: boolean
}>()
const rows = computed(() =>
  props.proposal.assertions.map((rule, index) => ({
    ...rule,
    expectedText: httpOperatorNeedsExpected(rule.operator)
      ? JSON.stringify(rule.expected)
      : undefined,
    evidence: props.showEvidence
      ? (props.proposal.evidence?.filter(
          item => item.assertionIndex === index,
        ) ?? [])
      : [],
  })),
)
</script>

<template>
  <div class="scrollbar overflow-x-auto">
    <table class="w-full table-fixed border-collapse text-left">
      <caption class="sr-only">
        {{
          i18n.t("ai.http.proposedCount", { count: rows.length })
        }}
      </caption>
      <colgroup>
        <col class="w-2/5">
        <col class="w-1/4">
        <col>
      </colgroup>
      <thead class="bg-muted">
        <tr>
          <th
            scope="col"
            class="px-3 py-2"
          >
            <UiText
              variant="xs"
              weight="medium"
            >
              {{ i18n.t("ai.http.table.target") }}
            </UiText>
          </th>
          <th
            scope="col"
            class="px-3 py-2"
          >
            <UiText
              variant="xs"
              weight="medium"
            >
              {{ i18n.t("ai.http.table.condition") }}
            </UiText>
          </th>
          <th
            scope="col"
            class="px-3 py-2"
          >
            <UiText
              variant="xs"
              weight="medium"
            >
              {{ i18n.t("ai.http.table.expected") }}
            </UiText>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(rule, index) in rows"
          :key="index"
          class="border-t align-top"
        >
          <td class="px-3 py-2 break-words">
            <UiText
              as="div"
              variant="sm"
              :title="rule.name"
            >
              {{ i18n.t(`spaces.http.runtime.sources.${rule.source}`) }}
            </UiText>
            <UiText
              v-if="rule.path !== undefined"
              as="div"
              variant="xs"
              mono
              class="mt-1 break-all whitespace-pre-wrap"
            >
              {{ rule.path || i18n.t("ai.http.table.root") }}
            </UiText>
            <UiText
              v-for="(evidence, evidenceIndex) in rule.evidence"
              :key="evidenceIndex"
              as="p"
              variant="xs"
              muted
              class="mt-2 break-words whitespace-pre-wrap"
            >
              {{ i18n.t(`ai.http.evidence.${evidence.source}`) }}:
              {{ evidence.quote }}
            </UiText>
          </td>
          <td class="px-3 py-2">
            <UiText variant="sm">
              {{ i18n.t(`spaces.http.runtime.operators.${rule.operator}`) }}
            </UiText>
          </td>
          <td class="px-3 py-2 break-words">
            <UiText
              v-if="rule.expectedText !== undefined"
              as="code"
              variant="sm"
              mono
              class="break-all whitespace-pre-wrap"
            >
              {{ rule.expectedText }}
            </UiText>
            <UiText
              v-else
              variant="sm"
              muted
              :aria-label="i18n.t('ai.http.table.noExpected')"
            >
              —
            </UiText>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
