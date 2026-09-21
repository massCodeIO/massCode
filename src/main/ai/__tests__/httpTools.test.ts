import type { AiHttpContext, AiHttpProposal } from '../../../shared/aiHttp'
import { describe, expect, it, vi } from 'vitest'
import { httpContextText } from '../../../shared/aiHttp'
import { createHttpTools } from '../httpTools'

const context: AiHttpContext = {
  contextId: 'a52a8b2b-09be-42c2-9355-05b89bb86817',
  requestId: 1,
  name: 'Order',
  request: '{"method":"GET"}',
  response: '{"status":200,"body":"{\\"id\\":42}"}',
  assertions: [],
}
const proposal: AiHttpProposal = {
  context_id: context.contextId,
  summary: 'Check the response',
  assertions: [
    {
      name: 'ID is numeric',
      source: 'json',
      path: '/id',
      operator: 'isNumber',
    },
  ],
}
function setup(snapshot = context) {
  const callback = vi.fn()
  const tools = createHttpTools(snapshot, callback)
  return {
    callback,
    ...tools,
    call: (name: string, input: unknown) =>
      tools.execute(name, JSON.stringify(input)),
  }
}
describe('hTTP assistant tools', () => {
  it('requires reading the response, validates and emits a single unapplied proposal', () => {
    const t = setup()
    expect(t.call('propose_http_assertions', proposal)).toEqual({
      error: 'READ_RESPONSE_FIRST',
    })
    t.call('read_http_context', { part: 'response' })
    expect(t.call('propose_http_assertions', proposal)).toMatchObject({
      status: 'awaiting_user_review',
      applied: false,
    })
    expect(t.callback).toHaveBeenCalledExactlyOnceWith(proposal)
    expect(t.call('propose_http_assertions', proposal)).toEqual({
      error: 'PROPOSAL_ALREADY_CREATED',
    })
  })
  it('reports missing response without inventing execution data', () => {
    const t = setup({ ...context, response: null })
    expect(t.call('read_http_context', { part: 'response' })).toMatchObject({
      available: false,
      reason: 'NO_RESPONSE',
    })
  })
  it('pages large response snapshots', () => {
    const t = setup({ ...context, response: 'a'.repeat(20000) })
    expect(t.call('read_http_context', { part: 'response' })).toMatchObject({
      content: 'a'.repeat(16000),
      nextOffset: 16000,
    })
    expect(
      t.call('read_http_context', { part: 'response', offset: 16000 }),
    ).toMatchObject({ content: 'a'.repeat(4000), nextOffset: null })
  })
  it('rejects wrong context, invalid pointers and duplicate assertions', () => {
    const t = setup({ ...context, assertions: proposal.assertions })
    t.call('read_http_context', { part: 'response' })
    expect(
      t.call('propose_http_assertions', {
        ...proposal,
        context_id: 'c82462c7-9f15-44ac-9014-01b9d5b5e2c9',
      }),
    ).toMatchObject({ error: 'INVALID_CONTEXT_OR_LIMIT' })
    expect(
      t.call('propose_http_assertions', {
        ...proposal,
        assertions: [{ ...proposal.assertions[0], path: '$.id' }],
      }),
    ).toMatchObject({ error: 'INVALID_ARGUMENTS' })
    expect(t.call('propose_http_assertions', proposal)).toMatchObject({
      error: 'DUPLICATE_ASSERTION',
    })
    expect(t.callback).not.toHaveBeenCalled()
  })
})

it('makes the end of a 100 KB response available on the first page and through tail reading', () => {
  const response = httpContextText({ body: `${'x'.repeat(100000)}QA-END` })
  const t = setup({ ...context, response })
  expect(t.call('read_http_context', { part: 'response' })).toMatchObject({
    totalLength: response.length,
    tailPreview: response.slice(-2000),
  })
  expect(
    t.call('read_http_context', { part: 'response', fromEnd: true }),
  ).toMatchObject({
    content: response.slice(-16000),
    offset: response.length - 16000,
    nextOffset: null,
  })
})
