import type { AiHttpProposal } from '~/shared/aiHttp'
import { i18n } from '@/electron'
import { httpOperatorNeedsExpected } from '~/shared/httpRuntime'

export function httpAssertionText(rule: AiHttpProposal['assertions'][number]) {
  return [
    i18n.t(`spaces.http.runtime.sources.${rule.source}`),
    rule.path,
    i18n.t(`spaces.http.runtime.operators.${rule.operator}`),
    httpOperatorNeedsExpected(rule.operator)
      ? JSON.stringify(rule.expected)
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function httpProposalText(proposal: AiHttpProposal) {
  return [
    proposal.analysis,
    i18n.t('ai.http.proposedCount', { count: proposal.assertions.length }),
    ...proposal.assertions.map(httpAssertionText),
  ]
    .filter(Boolean)
    .join('\n')
}
