import type { AiHttpContext, AiHttpProposal } from '../../shared/aiHttp'
import { httpOperatorNeedsExpected } from '../../shared/httpRuntime'

function parseRecord(text: string | null): Record<string, unknown> {
  try {
    const value = JSON.parse(text ?? '')
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}
  }
  catch {
    return {}
  }
}

const normalize = (text: string) => text.trim().replace(/\s+/gu, ' ')

// A matching excerpt proves provenance, not that the model interpreted it correctly.
// The exact quote remains visible in review alongside the executable check.
export function validateHttpEvidence(
  context: AiHttpContext,
  proposal: AiHttpProposal,
  userMessages: string[],
) {
  const request = parseRecord(context.request)
  const response = parseRecord(context.response)
  const sources = {
    user: userMessages,
    description:
      typeof request.description === 'string' ? [request.description] : [],
  }
  const cited = new Set<number>()
  for (const evidence of proposal.evidence ?? []) {
    if (
      evidence.assertionIndex >= proposal.assertions.length
      || cited.has(evidence.assertionIndex)
      || !sources[evidence.source].some(text =>
        normalize(text).includes(normalize(evidence.quote)),
      )
      || evidence.quote.includes('[REDACTED]')
    ) {
      return {
        error: 'INVALID_EVIDENCE',
        instruction:
          'Cite an exact relevant excerpt from the user request or request description. Never cite response data as a contract. Omit unsupported comparisons instead of inventing a source.',
      }
    }
    cited.add(evidence.assertionIndex)
  }
  const unsupported = proposal.assertions.flatMap((rule, index) => {
    if (!httpOperatorNeedsExpected(rule.operator) || cited.has(index))
      return []
    // Basic transport observations can be proposed without inventing business rules.
    if (
      rule.source === 'status'
      && rule.operator === 'eq'
      && typeof response.status === 'number'
      && response.status >= 200
      && response.status < 300
      && rule.expected === response.status
    ) {
      return []
    }
    const headers = response.headers
    const contentType = Array.isArray(headers)
      ? headers.find(
        header =>
          typeof header?.key === 'string'
          && header.key.toLowerCase() === 'content-type',
      )?.value
      : headers && typeof headers === 'object'
        ? Object.entries(headers).find(
          ([key]) => key.toLowerCase() === 'content-type',
        )?.[1]
        : undefined
    if (
      rule.source === 'header'
      && rule.path?.toLowerCase() === 'content-type'
      && rule.operator === 'contains'
      && rule.expected === 'application/json'
      && typeof contentType === 'string'
      && contentType.toLowerCase().includes('application/json')
    ) {
      return []
    }
    return [index]
  })
  if (unsupported.length) {
    return {
      error: 'UNSUPPORTED_EXPECTATION',
      assertionIndexes: unsupported,
      instruction:
        'These comparisons need evidence: assertionIndex (zero-based), source (user or description), and an exact relevant quote. A sample response cannot justify business values or timing limits. If no requirement is available, omit these comparisons and retain useful structural checks. Do not invent a quote.',
    }
  }
}
