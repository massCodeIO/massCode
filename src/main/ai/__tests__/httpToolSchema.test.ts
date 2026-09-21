import { expect, it } from 'vitest'
import { z } from 'zod'
import { httpProposalToolSchema, parseHttpProposal } from '../httpToolSchema'

const proposal = {
  context_id: 'a52a8b2b-09be-42c2-9355-05b89bb86817',
  summary: 'Check the response',
  analysis: 'The server returned an order, but no checks have run.',
  assertions: [
    {
      name: 'Fast',
      source: 'durationMs',
      path: null,
      operator: 'lt',
      expected: 1000,
    },
  ],
  evidence: [
    { assertionIndex: 0, source: 'user', quote: 'less than a second' },
  ],
}

it('exposes a closed strict schema with every property required at every level', () => {
  const schema = z.toJSONSchema(httpProposalToolSchema, { io: 'input' })
  function check(value: unknown) {
    if (!value || typeof value !== 'object')
      return
    if (Array.isArray(value)) {
      value.forEach(check)
      return
    }
    const node = value as Record<string, unknown>
    if (node.type === 'object') {
      expect(node.additionalProperties).toBe(false)
      expect(node.required).toEqual(Object.keys(node.properties as object))
    }
    Object.values(node).forEach(check)
  }
  check(schema)
  expect(httpProposalToolSchema.safeParse(proposal).success).toBe(true)
  expect(
    httpProposalToolSchema.safeParse({
      ...proposal,
      assertions: [{ ...proposal.assertions[0], source: undefined }],
    }).success,
  ).toBe(false)
})

it('normalizes nullable wire fields without inferring missing arguments', () => {
  expect(parseHttpProposal(proposal)).toMatchObject({
    analysis: proposal.analysis,
    assertions: [{ source: 'durationMs', path: undefined, expected: 1000 }],
  })
  expect(
    parseHttpProposal({ ...proposal, analysis: null }).analysis,
  ).toBeUndefined()
  expect(() =>
    parseHttpProposal({
      ...proposal,
      assertions: [{ ...proposal.assertions[0], source: undefined }],
    }),
  ).toThrow()
  expect(() =>
    parseHttpProposal({
      ...proposal,
      assertions: [{ ...proposal.assertions[0], expected: null }],
    }),
  ).toThrow()
})

it('preserves explicit JSON null equality and validates JSON pointer paths', () => {
  const assertion = {
    name: 'No failure',
    source: 'json',
    path: '/error',
    operator: 'eq',
    expected: null,
  }
  expect(
    parseHttpProposal({ ...proposal, assertions: [assertion] }).assertions[0]
      .expected,
  ).toBeNull()
  expect(() =>
    parseHttpProposal({
      ...proposal,
      assertions: [{ ...assertion, path: '$.error' }],
    }),
  ).toThrow()
})
