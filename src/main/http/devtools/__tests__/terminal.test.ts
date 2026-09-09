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
})
