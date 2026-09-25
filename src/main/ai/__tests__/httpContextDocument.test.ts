import { expect, it } from 'vitest'
import { httpContextDocument } from '../httpContextDocument'

it('explains snapshot bookkeeping without losing draft and execution differences', () => {
  const text = httpContextDocument(
    JSON.stringify({
      bodyType: 'none',
      body: null,
      error: null,
      executionInput: { method: 'POST', bodyType: 'json', body: '{"value":1}' },
      runtimeResults: { assertions: [], extractions: [] },
      durationMs: 7,
    }),
  )
  expect(text).toContain('Body format:\nnone')
  expect(text).toContain('Body format:\njson')
  expect(text).toContain(
    'Request definition used for this execution (before variable interpolation)',
  )
  expect(text).toContain('Check results: None recorded.')
  expect(text).toContain('Duration in milliseconds:\n7')
  expect(text).not.toMatch(
    /bodyType|executionInput|runtimeResults|error: null/,
  )
})

it('preserves payload fields that happen to resemble application internals', () => {
  const body
    = '{"bodyType":"custom","runtimeResults":{"assertions":[]},"error":null}'
  const text = httpContextDocument(
    JSON.stringify({
      body,
      description: body,
      headers: [{ key: 'runtimeResults', value: 'x' }],
    }),
  )
  expect(text).toContain(`body:\n${body}`)
  expect(text).toContain(`description:\n${body}`)
  expect(text).toContain('"key": "runtimeResults"')
})

it('retains actual failures and executed results rather than reporting no tests', () => {
  const result = { name: 'HTTP200', passed: false, actual: 500 }
  const text = httpContextDocument(
    JSON.stringify({
      error: 'Connection refused',
      runtimeResults: { assertions: [result] },
    }),
  )
  expect(text).toContain('Connection refused')
  expect(text).toContain('"passed": false')
  expect(text).toContain('"actual": 500')
  expect(text).not.toContain('None recorded.')
})

it('preserves explicit truncation markers and non-object captures', () => {
  const partial
    = '{"body":"first\n[TRUNCATED: middle omitted; original tail follows]\nQA-END'
  expect(httpContextDocument(partial)).toBe(partial)
  expect(httpContextDocument('[1,2]')).toBe('[1,2]')
})

it('preserves incomplete outgoing capture evidence in the model document', () => {
  const text = httpContextDocument(
    JSON.stringify({
      executionTrace: [
        {
          method: 'GET',
          url: 'https://example.test',
          requestHeaders: 'X-Large: partial…',
          truncated: true,
        },
      ],
    }),
  )
  expect(text).toContain('Captured outgoing attempts')
  expect(text).toContain('"truncated": true')
  expect(text).toContain('X-Large: partial…')
})
