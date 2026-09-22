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

it('routes attached snippet metadata to workspace review only when available', () => {
  const codeOnly = buildAiInstructions(['propose_edit'])
  expect(codeOnly).not.toContain('read_workspace_item')
  const combined = buildAiInstructions([
    'propose_edit',
    'read_workspace_item',
    'propose_workspace_changes',
  ])
  expect(combined).toContain('snippet-id identifies the saved snippet')
  expect(combined).toContain(
    'do not include code changes in a metadata-only proposal',
  )
  expect(combined).toContain('derive suitable values from the snippet content')
  expect(buildAiInstructions(['propose_workspace_changes'])).toContain(
    'snippet-id identifies the saved snippet',
  )
})

it('routes WebSocket disconnects to the available activity control tool', () => {
  const instructions = buildAiInstructions([
    'propose_http_action',
    'read_http_state',
    'control_http_activity',
  ])
  expect(instructions).toContain(
    'control_http_activity with {id: connectionId, action: "disconnect"}',
  )
  expect(instructions).toContain(
    'read_http_state with kind websocket and activityId connectionId first, then call control_http_activity',
  )
  expect(instructions).toContain('Never invent a disconnectWebSocket proposal')
  expect(buildAiInstructions(['propose_http_action'])).not.toContain(
    'HTTP activity controls:',
  )
})
