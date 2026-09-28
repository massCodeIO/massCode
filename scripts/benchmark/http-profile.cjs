const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const readline = require('node:readline')
const { parseArgs } = require('node:util')
const { app } = require('electron')
const { validateRoot } = require('./common.cjs')

const { values } = parseArgs({ options: {
  output: { type: 'string' },
  label: { type: 'string', default: 'current' },
} })
if (!values.output || !/^[a-z0-9-]+$/i.test(values.label))
  throw new Error('Expected --output benchmark-root and a simple --label')
const { root } = validateRoot(values.output)
app.setPath('userData', path.join(root, 'profile'))
app.setName('massCode HTTP profile')
const load = relative => require(path.join(root, 'build/main', relative))
const { store } = load('store')
if (store.preferences.get('storage.vaultPath') !== path.join(root, 'vault')
  || store.preferences.get('storage.rootPath') !== path.join(root, 'vault')) {
  throw new Error('Benchmark storage isolation mismatch')
}

async function startServer() {
  const child = spawn(process.execPath, [
    path.resolve(__dirname, '../http-dev-server/index.mjs'),
    ...['websocket', 'scripts', 'showcase', 'graphql', 'transport', 'cross-origin'].flatMap(name => [`--${name}-port`, '0']),
  ], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'inherit'] })
  const exited = new Promise(resolve => child.once('close', resolve))
  const close = async () => {
    child.kill('SIGTERM')
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000)
    await exited
    clearTimeout(timeout)
  }
  const lines = readline.createInterface({ input: child.stdout })
  let timeout
  try {
    const origin = await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Dev server startup timeout')), 10000)
      child.once('error', reject)
      child.once('exit', () => reject(new Error('Dev server exited before ready')))
      lines.on('line', (line) => {
        try {
          const ready = JSON.parse(line)
          if (ready.event === 'ready') {
            const url = new URL(ready.addresses.transport)
            assert.equal(url.hostname, '127.0.0.1')
            assert.equal(url.protocol, 'http:')
            clearTimeout(timeout)
            resolve(url.origin)
          }
        }
        catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      })
    })
    return { origin, close }
  }
  catch (error) {
    await close()
    throw error
  }
  finally {
    clearTimeout(timeout)
    lines.close()
  }
}

async function main() {
  await app.whenReady()
  const server = await startServer()
  try {
    const { getHttpRuntimeCache, isHttpVaultDiskReady } = load('storage/providers/markdown/http/runtime/sync')
    const { getHttpPaths } = load('storage/providers/markdown/http/runtime/paths')
    const paths = getHttpPaths(path.join(root, 'vault'))
    getHttpRuntimeCache(paths)
    const deadline = Date.now() + 120000
    while (!isHttpVaultDiskReady(paths)) {
      if (Date.now() > deadline)
        throw new Error('HTTP library did not finish syncing')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const { executeHttpRequest } = load('http/runtime/execute')
    const storage = load('storage').useHttpStorage()
    assert.equal(storage.environments.getActiveEnvironmentId(), null, 'Use a benchmark without an active environment')
    const configuredLimit = store.preferences.get('http')?.historyLimit
    const historyLimit = [0, 10, 20, 50, 100].includes(configuredLimit) ? configuredLimit : 20
    assert.ok(historyLimit > 0, 'History must be enabled for this protocol')
    const rows = []
    const payloadBody = 'x'.repeat(1024)
    for (const [scenario, endpoint, count] of [
      ['first-echo-1k', '/echo', 1],
      ['warmup-echo-1k', '/echo', 5],
      ['series-echo-1k', '/echo', 100],
      ['series-response-1m', '/bytes/1048576', 30],
      ['series-delay-10ms', '/delay/10', 30],
    ]) {
      const durations = []
      const transportDurations = []
      let last = performance.now()
      let maxEventLoopDelayMs = 0
      let sampledPeakRss = process.memoryUsage().rss
      const sample = () => {
        const now = performance.now()
        maxEventLoopDelayMs = Math.max(maxEventLoopDelayMs, now - last - 10)
        sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss)
        last = now
      }
      const heartbeat = setInterval(sample, 10)
      const started = performance.now()
      let lastUrl
      try {
        for (let index = 0; index < count; index++) {
          lastUrl = `${server.origin}${endpoint}?benchmark=${values.label}-${scenario}-${index}`
          const before = performance.now()
          const result = await executeHttpRequest({
            requestId: null,
            environmentId: null,
            request: { method: endpoint === '/echo' ? 'POST' : 'GET', url: lastUrl, headers: [], query: [], auth: { type: 'none' }, bodyType: 'text', body: endpoint === '/echo' ? payloadBody : '', formData: [] },
            transport: { followRedirects: true, timeoutMs: 10000 },
          })
          durations.push(performance.now() - before)
          transportDurations.push(result.durationMs)
          assert.equal(result.status, 200)
          assert.ok(!result.error && !result.discarded && !result.truncated)
          if (endpoint === '/echo') {
            const echo = JSON.parse(result.body)
            assert.equal(echo.method, 'POST')
            assert.equal(echo.body, payloadBody)
          }
          else if (endpoint.startsWith('/bytes/')) {
            assert.equal(result.sizeBytes, 1048576)
            assert.equal(result.bodyKind, 'binary')
            assert.equal(result.body, '')
          }
          else { assert.equal(JSON.parse(result.body).delay, 10) }
        }
      }
      finally {
        sample()
        clearInterval(heartbeat)
      }
      const elapsedMs = performance.now() - started
      assert.ok(storage.history.getEntries().some(entry => entry.url === lastUrl), 'Execution history was not saved')
      const sorted = [...durations].sort((a, b) => a - b)
      rows.push({ scenario, count, elapsedMs, requestsPerSecond: count / elapsedMs * 1000, p50: sorted[Math.ceil(count * 0.5) - 1], p95: count >= 20 ? sorted[Math.ceil(count * 0.95) - 1] : null, maxMs: sorted.at(-1), durations, transportDurations, sampledPeakRss, maxEventLoopDelayMs })
    }
    const file = path.join(root, `http-${values.label}-${Date.now()}.json`)
    fs.writeFileSync(file, JSON.stringify({ label: values.label, root, createdAt: new Date().toISOString(), runtimeSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'build/main/http/runtime/execute.js'))).digest('hex'), historyLimit, rows, note: 'Sequential real executeHttpRequest with history, cookies and diagnostics; draft requestId=null. No renderer/IPC, scripts, TLS, remote network or collection runner. Dev server runs in a separate process on random loopback ports. Throughput includes result assertions; p50/p95 time the runtime call including history. Warmups are reported separately. History is retained in the disposable vault.' }, null, 2))
    console.log(file)
  }
  finally { await server.close() }
}
main().then(() => app.exit(0)).catch((error) => {
  console.error(error)
  app.exit(1)
})
