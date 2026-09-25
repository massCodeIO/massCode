import { beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mock = vi.hoisted(() => ({
  list: [
    {
      id: 'one',
      sequence: 2,
      output: 'secret output',
      title: 'Shell',
      cols: 80,
      rows: 24,
    },
  ] as any[],
  fail: false,
  invoke: vi.fn(),
}))
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { invoke: mock.invoke, on: vi.fn(), removeListeners: vi.fn() },
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class {} }))
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    loadAddon() {}
    onData() {}
    onResize() {}
    onTitleChange() {}
    write(_data: string, callback?: () => void) {
      callback?.()
    }

    dispose() {}
  },
}))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('ref', ref)
  mock.fail = false
  mock.list = [
    {
      id: 'one',
      sequence: 2,
      output: 'secret output',
      title: 'Shell',
      cols: 80,
      rows: 24,
    },
  ]
  mock.invoke.mockImplementation(async (channel: string, payload: any) => {
    if (channel === 'spaces:http:terminal:list')
      return structuredClone(mock.list)
    if (channel === 'spaces:http:terminal:clear') {
      if (mock.fail)
        throw new Error('clear failed')
      mock.list[0].sequence++
      mock.list[0].output = ''
    }
    if (channel === 'spaces:http:terminal:kill')
      mock.list = mock.list.filter(session => session.id !== payload.id)
  })
})
it('confirms clear and close through native session state without entering shell commands', async () => {
  const terminal = (await import('../useHttpTerminal')).useHttpTerminal()
  expect(await terminal.control('terminalOpen', undefined, () => true)).toBe(
    true,
  )
  expect(await terminal.control('terminalClear', 'one', () => true)).toBe(true)
  expect(mock.list[0].output).toBe('')
  expect(await terminal.control('terminalClose', 'one', () => true)).toBe(true)
  expect(terminal.sessions.value).toEqual([])
  expect(
    mock.invoke.mock.calls.some(
      ([channel]) => channel === 'spaces:http:terminal:input',
    ),
  ).toBe(false)
})
it('rejects stale and missing sessions and propagates failed native operations', async () => {
  const terminal = (await import('../useHttpTerminal')).useHttpTerminal()
  expect(await terminal.control('terminalClear', 'missing', () => true)).toBe(
    false,
  )
  expect(await terminal.control('terminalClear', 'one', () => false)).toBe(
    false,
  )
  expect(
    mock.invoke.mock.calls.some(
      ([channel]) => channel === 'spaces:http:terminal:clear',
    ),
  ).toBe(false)
  mock.fail = true
  await expect(
    terminal.control('terminalClear', 'one', () => true),
  ).rejects.toThrow('clear failed')
  expect(mock.list[0].output).toBe('secret output')
})
it('creates and verifies a native session, preserving native limit and error behavior', async () => {
  const terminal = (await import('../useHttpTerminal')).useHttpTerminal()
  const original = mock.invoke.getMockImplementation()!
  mock.invoke.mockImplementation(async (channel, payload) => {
    if (channel !== 'spaces:http:terminal:create')
      return original(channel, payload)
    if (mock.list.length >= 12)
      throw new Error('TERMINAL_LIMIT')
    const session = { ...mock.list[0], id: `session-${mock.list.length}` }
    mock.list.push(session)
    return session
  })
  expect(await terminal.control('terminalCreate', undefined, () => true)).toBe(
    true,
  )
  expect(terminal.activeId.value).toBe('session-1')
  mock.list = Array.from({ length: 12 }, (_, index) => ({
    ...mock.list[0],
    id: String(index),
  }))
  expect(await terminal.control('terminalCreate', undefined, () => true)).toBe(
    false,
  )
  expect(terminal.error.value).toContain('TERMINAL_LIMIT')
  expect(
    mock.invoke.mock.calls.some(
      ([channel]) => channel === 'spaces:http:terminal:input',
    ),
  ).toBe(false)
})
