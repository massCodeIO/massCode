import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({ profile: '', on: vi.fn(), trusted: true }))
vi.mock('electron', () => ({
  app: {
    getPath: () => mocked.profile,
    on: mocked.on,
    getAppMetrics: () => [],
  },
}))
vi.mock('../../src/main/api/requestIpc', () => ({
  isTrustedApiRequest: () => mocked.trusted,
}))
let root: string | undefined
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.resetModules()
  mocked.on.mockClear()
  if (root)
    fs.rmSync(root, { recursive: true, force: true })
  root = undefined
})
describe('opt-in recorder', () => {
  it('does not register or write when disabled', async () => {
    vi.stubEnv('MASSCODE_BENCHMARK_ROOT', '')
    const recorder = await import('../../src/main/benchmark')
    expect(recorder.benchmarkEnabled).toBe(false)
    const ipc = { handle: vi.fn() }
    recorder.registerBenchmark({ ipc } as any, 'file:///index.html')
    recorder.recordBenchmark('test', 10)
    expect(ipc.handle).not.toHaveBeenCalled()
    expect(mocked.on).not.toHaveBeenCalled()
  })
  it('checks sender and metric allowlist before writing bounded events', async () => {
    vi.useFakeTimers()
    root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-recorder-test-')),
    )
    for (const name of ['profile', 'vault'])
      fs.mkdirSync(path.join(root, name))
    fs.writeFileSync(
      path.join(root, '.masscode-benchmark.json'),
      JSON.stringify({ version: 1, root }),
    )
    mocked.profile = path.join(root, 'profile')
    vi.stubEnv('MASSCODE_BENCHMARK_ROOT', root)
    vi.stubEnv('MASSCODE_BENCHMARK_STARTED', String(performance.now()))
    const recorder = await import('../../src/main/benchmark')
    const ipc = { handle: vi.fn() }
    recorder.registerBenchmark(
      { ipc, on: vi.fn() } as any,
      'file:///index.html',
    )
    const handle = ipc.handle.mock.calls[0][1]
    mocked.trusted = false
    await expect(
      handle(
        {},
        { name: 'code.open.state-presented', durationMs: 10, status: 'ok' },
      ),
    ).rejects.toThrow('Unauthorized')
    mocked.trusted = true
    await handle({}, { name: 'private content', durationMs: 10, status: 'ok' })
    await handle(
      {},
      { name: 'code.open.state-presented', durationMs: Infinity, status: 'ok' },
    )
    await handle(
      {},
      {
        name: 'code.open.state-presented',
        durationMs: 10,
        status: 'ok',
        content: 'never record',
      },
    )
    for (const status of ['error', 'superseded', 'ok', 'ok']) {
      await handle(
        {},
        { name: 'code.search-first.state-presented', durationMs: 20, status },
      )
    }
    await vi.advanceTimersByTimeAsync(1000)
    const log = fs.readFileSync(path.join(root, 'events.jsonl'), 'utf8')
    expect(log).toContain('code.open.state-presented')
    expect(log).not.toContain('private content')
    expect(log).not.toContain('never record')
    expect(log).not.toContain('Infinity')
    const events = log
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    expect(
      events.every(
        event => Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0,
      ),
    ).toBe(true)
    const memory = fs
      .readFileSync(path.join(root, 'memory.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    expect(
      memory.filter(
        row => row.milestone === 'code.search-first.state-presented',
      ),
    ).toHaveLength(1)
    expect(memory.every(row => Number.isFinite(row.elapsedMs))).toBe(true)
    expect(process.env.MASSCODE_BENCHMARK_ROOT).toBe(root)
  })
})
