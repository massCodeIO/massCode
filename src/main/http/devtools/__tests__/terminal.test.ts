import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  terminalInputSchema,
  terminalResizeSchema,
} from '../../../../shared/httpDevtools'
import { HttpTerminalManager } from '../terminal'

const managers: HttpTerminalManager[] = []
afterEach(() => {
  managers.forEach(manager => manager.dispose())
  managers.length = 0
  vi.unstubAllEnvs()
})
describe('terminal boundaries', () => {
  it('rejects malformed IPC payloads', () => {
    expect(
      terminalInputSchema.safeParse({ id: '../other', data: 'x' }).success,
    ).toBe(false)
    expect(
      terminalResizeSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000000',
        cols: 0,
        rows: 1,
      }).success,
    ).toBe(false)
  })
  it.skipIf(process.platform === 'win32')(
    'runs isolated PTYs, resize, interrupt, exit and cleanup',
    async () => {
      vi.stubEnv('SHELL', '/bin/sh')
      const manager = new HttpTerminalManager(() => {})
      managers.push(manager)
      const first = manager.create(80, 24)
      const second = manager.create(90, 30)
      manager.input(
        first.id,
        'QA_SESSION=one; test -t 0 && echo QA_TTY_OK; stty size\r',
      )
      await vi.waitFor(() =>
        expect(manager.list()[0].output).toContain('24 80'),
      )
      expect(manager.list()[0].output).toContain('QA_TTY_OK')
      // eslint-disable-next-line no-template-curly-in-string -- shell parameter expansion
      manager.input(second.id, 'echo "QA_VALUE=${QA_SESSION-unset}"\r')
      await vi.waitFor(() =>
        expect(manager.list()[1].output).toContain('QA_VALUE=unset\r\n'),
      )
      manager.resize(first.id, 100, 40)
      manager.input(first.id, 'stty size\r')
      await vi.waitFor(() =>
        expect(manager.list()[0].output).toContain('40 100'),
      )
      manager.input(first.id, 'sleep 30\r')
      await new Promise(resolve => setTimeout(resolve, 100))
      manager.input(first.id, '\x03')
      manager.input(first.id, 'echo QA_INTERRUPTED\r')
      await vi.waitFor(() =>
        expect(manager.list()[0].output).toContain('QA_INTERRUPTED\r\n'),
      )
      manager.clear(first.id)
      expect(manager.list()[0].output).toBe('')
      manager.input(second.id, 'exit 7\r')
      await vi.waitFor(() => expect(manager.list()[1].exitCode).toBe(7))
      expect(() => manager.input(second.id, 'x')).toThrow(
        'TERMINAL_SESSION_EXITED',
      )
      manager.dispose()
      expect(manager.list()).toEqual([])
    },
  )
  it.skipIf(process.platform === 'win32')(
    'bounds unconsumed output and resumes without losing the tail',
    async () => {
      vi.stubEnv('SHELL', '/bin/sh')
      let acknowledge = false
      const manager = new HttpTerminalManager((event) => {
        if (acknowledge && event.type === 'data')
          setImmediate(() => manager.acknowledge(event.id, event.sequence))
      })
      managers.push(manager)
      const session = manager.create(80, 24)
      manager.input(
        session.id,
        'head -c 2097152 /dev/zero | tr \'\\0\' x; printf \'\\nQA_FLOOD_DONE\\n\'\r',
      )
      await vi.waitFor(() =>
        expect(manager.list()[0].output.length).toBeGreaterThanOrEqual(
          256 * 1024,
        ),
      )
      await new Promise(resolve => setTimeout(resolve, 100))
      const paused = manager.list()[0]
      expect(paused.output.length).toBeLessThan(512 * 1024)
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(manager.list()[0].sequence).toBe(paused.sequence)
      acknowledge = true
      manager.acknowledge(session.id, paused.sequence)
      await vi.waitFor(
        () =>
          expect(manager.list()[0].output).toContain('\r\nQA_FLOOD_DONE\r\n'),
        { timeout: 5000 },
      )
      expect(manager.list()[0].truncated).toBe(true)
      expect(manager.list()[0].output.length).toBeLessThanOrEqual(1024 * 1024)
    },
  )
})
