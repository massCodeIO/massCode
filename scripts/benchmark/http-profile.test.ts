import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const source = fs.readFileSync(
  new URL('./http-profile.cjs', import.meta.url),
  'utf8',
)
const root = '/isolated-http-benchmark'

afterEach(() => vi.useRealTimers())

function runProfile() {
  let ready = false
  const stop = new Error('Reached HTTP execution')
  const executeHttpRequest = vi.fn().mockRejectedValue(stop)
  const getHttpRuntimeCache = vi.fn(() => ({
    state: {},
    requestById: new Map(),
  }))
  const isHttpVaultDiskReady = vi.fn(() => ready)
  const close = vi.fn().mockResolvedValue(undefined)
  const modules = {
    'store': {
      store: {
        preferences: {
          get: (key: string) =>
            key === 'http' ? { historyLimit: 20 } : path.join(root, 'vault'),
        },
      },
    },
    'storage/providers/markdown/http/runtime/sync': {
      getHttpRuntimeCache,
      isHttpVaultDiskReady,
    },
    'storage/providers/markdown/http/runtime/paths': {
      getHttpPaths: (vault: string) => ({ vault }),
    },
    'http/runtime/execute': { executeHttpRequest },
    'storage': {
      useHttpStorage: () => ({
        environments: { getActiveEnvironmentId: () => null },
      }),
    },
  }
  const context = {
    require: (name: string) => {
      if (name === 'electron') {
        return {
          app: {
            whenReady: async () => {},
            setPath: () => {},
            setName: () => {},
          },
        }
      }
      if (name === './common.cjs')
        return { validateRoot: () => ({ root }) }
      if (name === 'node:util') {
        return {
          parseArgs: () => ({ values: { output: root, label: 'test' } }),
        }
      }
      const relative = path.relative(path.join(root, 'build/main'), name)
      if (relative in modules)
        return modules[relative as keyof typeof modules]
      return require(name)
    },
    setTimeout,
    setInterval,
    clearInterval,
    Date,
    performance,
    server: { origin: 'http://127.0.0.1:1234', close },
  }
  // Run the actual orchestration, replacing only the external server lifecycle
  // and terminal app.exit handler. The readiness gate is left intact.
  const body = source.slice(0, source.lastIndexOf('\nmain().then'))
  const finished = vm.runInNewContext(
    `${body}\nstartServer = async () => server; main()`,
    context,
  ) as Promise<void>
  return {
    finished: finished.catch(error => error),
    executeHttpRequest,
    getHttpRuntimeCache,
    isHttpVaultDiskReady,
    close,
    stop,
    markReady: () => {
      ready = true
    },
  }
}

it('waits for disk reconciliation even when a local state has no provisional flag', async () => {
  vi.useFakeTimers()
  const run = runProfile()
  await vi.advanceTimersByTimeAsync(200)
  expect(run.getHttpRuntimeCache).toHaveBeenCalledTimes(1)
  expect(run.isHttpVaultDiskReady).toHaveBeenCalled()
  expect(run.executeHttpRequest).not.toHaveBeenCalled()
  run.markReady()
  await vi.advanceTimersByTimeAsync(50)
  expect(run.executeHttpRequest).toHaveBeenCalledTimes(1)
  expect(await run.finished).toBe(run.stop)
  expect(run.close).toHaveBeenCalledTimes(1)
})

it('fails without sending requests when reconciliation never completes', async () => {
  vi.useFakeTimers()
  const run = runProfile()
  await vi.advanceTimersByTimeAsync(120100)
  expect((await run.finished).message).toBe(
    'HTTP library did not finish syncing',
  )
  expect(run.executeHttpRequest).not.toHaveBeenCalled()
  expect(run.close).toHaveBeenCalledTimes(1)
})
