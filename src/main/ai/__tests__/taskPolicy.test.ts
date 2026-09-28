import { expect, it } from 'vitest'
import { taskEffect } from '../taskPolicy'

it('read-only tasks block every mutation and network path while retaining reads', () => {
  for (const name of [
    'propose_edit',
    'propose_http_assertions',
    'propose_workspace_changes',
    'create_workspace_items',
    'request_import',
    'request_export',
    'propose_http_action',
  ]) {
    expect(taskEffect('readOnly', name, { action: 'runCollection' })).toBe(
      'blocked',
    )
  }
  expect(taskEffect('readOnly', 'read_workspace_item', {})).toBe('read')
  expect(
    taskEffect('readOnly', 'control_http_activity', { action: 'status' }),
  ).toBe('read')
  expect(
    taskEffect('readOnly', 'perform_native_action', {
      operation: { action: 'readNotesDashboard' },
    }),
  ).toBe('read')
  expect(
    taskEffect('readOnly', 'perform_native_action', {
      operation: { action: 'notesPage', page: 'dashboard' },
    }),
  ).toBe('blocked')
})
it('applies reversible edits, waits for explicit previews and always confirms network and trust', () => {
  for (const tool of [
    'propose_edit',
    'propose_http_assertions',
    'propose_workspace_changes',
    'create_workspace_items',
  ]) {
    expect(taskEffect('apply', tool, {})).toBe('apply')
    expect(taskEffect('preview', tool, {})).toBe('preview')
  }
  expect(
    taskEffect('apply', 'propose_http_action', { action: 'patchDraft' }),
  ).toBe('apply')
  for (const action of ['send', 'runCollection', 'scriptTrust', 'saveAndSend']) {
    expect(taskEffect('apply', 'propose_http_action', { action })).toBe(
      'preview',
    )
  }
  expect(
    taskEffect('apply', 'propose_workspace_changes', {
      operations: [{ action: 'permanentDelete' }],
    }),
  ).toBe('preview')
})

it('reads preferences without write authority and confirms sensitive settings', () => {
  const tool = 'perform_native_action'
  expect(
    taskEffect('readOnly', tool, { operation: { action: 'readPreferences' } }),
  ).toBe('read')
  expect(
    taskEffect('readOnly', tool, {
      operation: {
        action: 'setPreferences',
        change: { group: 'code', values: { fontSize: 16 } },
      },
    }),
  ).toBe('blocked')
  expect(
    taskEffect('apply', tool, {
      operation: {
        action: 'setPreferences',
        change: { group: 'code', values: { fontSize: 16 } },
      },
    }),
  ).toBe('apply')
  for (const change of [
    { group: 'tasks', values: { autoCleanupCompleted: '1d' } },
    {
      group: 'http',
      values: { transport: { followAuthorizationHeader: true } },
    },
  ]) {
    expect(
      taskEffect('apply', tool, {
        operation: { action: 'setPreferences', change },
      }),
    ).toBe('preview')
  }
})

it('requires confirmation whenever preview JavaScript can execute again and for reload', () => {
  for (const action of ['codePreview', 'reload']) {
    expect(
      taskEffect('apply', 'perform_native_action', {
        operation: { action, command: 'refresh' },
      }),
    ).toBe('preview')
    expect(
      taskEffect('readOnly', 'perform_native_action', {
        operation: { action, command: 'refresh' },
      }),
    ).toBe('blocked')
  }
})

it('keeps HTTP overview and runner metadata reads available without permitting navigation or stop', () => {
  for (const action of ['httpOverview', 'httpRunner']) {
    expect(
      taskEffect('readOnly', 'perform_native_action', {
        operation: { action, command: 'read' },
      }),
    ).toBe('read')
    expect(
      taskEffect('readOnly', 'perform_native_action', {
        operation: { action, command: 'open' },
      }),
    ).toBe('blocked')
  }
  expect(
    taskEffect('readOnly', 'perform_native_action', {
      operation: { action: 'httpRunner', command: 'stop' },
    }),
  ).toBe('blocked')
})
