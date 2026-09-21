import type { AiHttpContext, AiHttpProposal } from '../../../shared/aiHttp'
import { describe, expect, it } from 'vitest'
import { validateHttpEvidence } from '../httpEvidence'

const context: AiHttpContext = {
  contextId: 'a52a8b2b-09be-42c2-9355-05b89bb86817',
  requestId: 1,
  name: 'Order',
  request: JSON.stringify({
    description: 'The response must arrive within 2 seconds.',
  }),
  response: JSON.stringify({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: '{"status":"paid"}',
    durationMs: 2,
  }),
  assertions: [],
}
function make(
  assertions: AiHttpProposal['assertions'],
  evidence?: AiHttpProposal['evidence'],
): AiHttpProposal {
  return {
    context_id: context.contextId,
    summary: 'A summary is not evidence',
    assertions,
    evidence,
  }
}
const duration: AiHttpProposal['assertions'][number] = {
  name: 'Fast',
  source: 'durationMs',
  operator: 'lt',
  expected: 1000,
}

describe('hTTP expectation provenance', () => {
  it('rejects sample business values and arbitrary latency bounds', () => {
    expect(
      validateHttpEvidence(
        context,
        make([
          duration,
          {
            name: 'Paid',
            source: 'json',
            path: '/status',
            operator: 'eq',
            expected: 'paid',
          },
        ]),
        ['Add useful tests'],
      ),
    ).toMatchObject({
      error: 'UNSUPPORTED_EXPECTATION',
      assertionIndexes: [0, 1],
    })
  })
  it('allows structural checks and observed successful transport without business claims', () => {
    expect(
      validateHttpEvidence(
        context,
        make([
          { name: 'OK', source: 'status', operator: 'eq', expected: 200 },
          {
            name: 'JSON',
            source: 'header',
            path: 'content-type',
            operator: 'contains',
            expected: 'application/json',
          },
          {
            name: 'Status type',
            source: 'json',
            path: '/status',
            operator: 'isString',
          },
        ]),
        [],
      ),
    ).toBeUndefined()
  })
  it('does not normalize a failure or invent a successful status from an absent response', () => {
    const assertion = {
      name: 'OK',
      source: 'status' as const,
      operator: 'eq' as const,
      expected: 500,
    }
    expect(
      validateHttpEvidence(
        { ...context, response: '{"status":500}' },
        make([assertion]),
        [],
      ),
    ).toMatchObject({ error: 'UNSUPPORTED_EXPECTATION' })
    expect(
      validateHttpEvidence(
        { ...context, response: null },
        make([{ ...assertion, expected: 200 }]),
        [],
      ),
    ).toMatchObject({ error: 'UNSUPPORTED_EXPECTATION' })
  })
  it('accepts a quoted explicit user limit and preserves its evidence for review', () => {
    const p = make(
      [duration],
      [{ assertionIndex: 0, source: 'user', quote: 'меньше секунды' }],
    )
    expect(
      validateHttpEvidence(context, p, [
        'Добавь проверку: время ответа меньше секунды.',
        'Да, добавь её.',
      ]),
    ).toBeUndefined()
    expect(p.evidence?.[0].quote).toBe('меньше секунды')
  })
  it('accepts requirements from description, not response text or record names', () => {
    const p = make(
      [{ ...duration, expected: 2000 }],
      [{ assertionIndex: 0, source: 'description', quote: 'within 2 seconds' }],
    )
    expect(validateHttpEvidence(context, p, [])).toBeUndefined()
    p.evidence![0].quote = 'the response must be paid'
    expect(
      validateHttpEvidence(
        {
          ...context,
          name: 'the response must be paid',
          response: 'the response must be paid',
        },
        p,
        [],
      ),
    ).toMatchObject({ error: 'INVALID_EVIDENCE' })
  })
  it('rejects forged, redacted, duplicate and out-of-range citations', () => {
    for (const evidence of [
      [{ assertionIndex: 0, source: 'user' as const, quote: 'fabricated' }],
      [{ assertionIndex: 0, source: 'user' as const, quote: '[REDACTED]' }],
      [
        {
          assertionIndex: 1,
          source: 'user' as const,
          quote: 'less than a second',
        },
      ],
      [0, 0].map(assertionIndex => ({
        assertionIndex,
        source: 'user' as const,
        quote: 'less than a second',
      })),
    ]) {
      expect(
        validateHttpEvidence(context, make([duration], evidence), [
          'less than a second [REDACTED]',
        ]),
      ).toMatchObject({ error: 'INVALID_EVIDENCE' })
    }
  })
})
