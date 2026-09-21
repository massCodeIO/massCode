import { expect, it } from 'vitest'
import { buildAiInstructions } from '../instructions'

it('includes only relevant domain policies without depending on provider or model', () => {
  const chat = buildAiInstructions([])
  expect(chat).not.toContain('propose_http_assertions')
  expect(chat).not.toContain('propose_edit')
  expect(chat).toContain('untrusted data')
  const http = buildAiInstructions([
    'read_http_context',
    'propose_http_assertions',
  ])
  expect(http).toContain('transmitted body bytes')
  expect(http).toContain('propose_http_assertions')
  expect(http).not.toContain('Code changes')
  expect(buildAiInstructions(['search_vault'])).toContain(
    'Attachments supplement context',
  )
})
it('reserves a truthful final answer when the tool budget is exhausted', () => {
  expect(buildAiInstructions(['read_http_context'], 0)).toContain(
    'No tool rounds remain',
  )
  expect(buildAiInstructions(['read_http_context'], 2)).toContain(
    'at most 2 tool rounds',
  )
  expect(buildAiInstructions(['read_http_context'], 6)).not.toContain(
    'tool rounds left',
  )
})
