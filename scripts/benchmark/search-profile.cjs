const assert = require('node:assert/strict')
const crypto = require('node:crypto')
// Запускать Electron: отдельный процесс для каждого A/B-прохода.
const fs = require('node:fs')
const { Session } = require('node:inspector')
const path = require('node:path')
const process = require('node:process')
const { parseArgs } = require('node:util')
const { app } = require('electron')
const { validateRoot } = require('./common.cjs')

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'output': { type: 'string' },
    'tokens': { type: 'string' },
    'build': { type: 'string' },
    'record-index': { type: 'string' },
    'label': { type: 'string', default: 'current' },
    'cpu': { type: 'boolean', default: false },
    'heap': { type: 'boolean', default: false },
  },
})
if (!values.output || !/^[a-z0-9-]+$/i.test(values.label))
  throw new Error('Expected --output benchmark-root and a simple --label')
const recordIndex = values['record-index'] === undefined ? undefined : Number(values['record-index'])
if (recordIndex !== undefined && (!Number.isSafeInteger(recordIndex) || recordIndex < 0))
  throw new Error('Expected nonnegative --record-index')
const { root, marker } = validateRoot(values.output)
const seed = JSON.parse(fs.readFileSync(path.join(root, 'seed.json'), 'utf8'))
app.setPath('userData', path.join(root, 'profile'))
app.setName('massCode search profile')
const buildRoot = path.resolve(values.build || path.join(root, 'build'))
const load = relative => require(path.join(buildRoot, 'main', relative))
const { store } = load('store')
if (
  store.preferences.get('storage.vaultPath') !== path.join(root, 'vault')
  || store.preferences.get('storage.rootPath') !== path.join(root, 'vault')
) {
  throw new Error('Benchmark storage isolation mismatch')
}
const runtime = 'storage/providers/markdown/runtime/'
const tokenModule = path.resolve(
  values.tokens
  || path.join(buildRoot, 'main', runtime, 'shared/searchIndex.js'),
)
if (values.tokens) {
  const tokenize = require(tokenModule).buildSearchTokens
  // Historical tokenizer builds accept one string, not segmented text.
  load(`${runtime}shared/searchIndex`).buildSearchTokens = text =>
    tokenize(Array.isArray(text) ? text.join(' ') : text)
}
let phases = null
function instrument(module, key, name) {
  const original = module[key]
  module[key] = function (...args) {
    const start = performance.now()
    try {
      return original.apply(this, args)
    }
    finally {
      if (phases)
        phases[name] = (phases[name] || 0) + performance.now() - start
    }
  }
}
instrument(load(`${runtime}snippets`), 'ensureSnippetContentLoaded', 'hydrate')
instrument(
  load('storage/providers/markdown/notes/runtime/notes'),
  'ensureAllNoteContentsLoaded',
  'hydrate',
)
const noteRuntime = load('storage/providers/markdown/notes/runtime/notes')
if (typeof noteRuntime.ensureNoteContentLoaded === 'function')
  instrument(noteRuntime, 'ensureNoteContentLoaded', 'hydrateItem')
for (const [module, key] of [
  [load(`${runtime}search`), 'prepareSnippetSearchAsync'],
  [load('storage/providers/markdown/notes/runtime/search'), 'prepareNoteSearchAsync'],
]) {
  if (typeof module[key] !== 'function')
    continue
  const original = module[key]
  module[key] = async function (...args) {
    const measuredPhases = phases
    const start = performance.now()
    try {
      return await original.apply(this, args)
    }
    finally {
      if (measuredPhases)
        measuredPhases.prepareAsync = (measuredPhases.prepareAsync || 0) + performance.now() - start
    }
  }
}
instrument(load(`${runtime}parser`), 'splitFrontmatter', 'parseFrontmatter')
instrument(
  load(`${runtime}parser`),
  'parseBodyFragmentsWithMetadata',
  'parseFragments',
)
instrument(load(`${runtime}shared/searchEngine`), 'buildSearchIndex', 'index')
instrument(load(`${runtime}shared/searchEngine`), 'querySearchIndex', 'query')
if (typeof load(`${runtime}shared/searchEngine`).updateSearchIndexItem === 'function') {
  instrument(load(`${runtime}shared/searchEngine`), 'updateSearchIndexItem', 'updateIndex')
}
const extraFs = require('fs-extra')

instrument(extraFs, 'readFileSync', 'readFiles')
const rows = []
const editedContentChars = {}
const cpuProfiles = []
const heapProfiles = []
app
  .whenReady()
  .then(async () => {
    const token = crypto.randomUUID()
    const api = load('api/app').createApiApp({
      port: marker.port,
      sessionToken: token,
      version: app.getVersion(),
    })
    async function call(method, endpoint, body) {
      const response = await api.handle(
        new Request(`http://127.0.0.1:${marker.port}${endpoint}`, {
          method,
          headers: {
            'host': `127.0.0.1:${marker.port}`,
            'authorization': `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      )
      if (!response.ok) {
        throw new Error(
          `${endpoint}: ${response.status} ${await response.text()}`,
        )
      }
      return response.json()
    }
    async function measureCall(space, scenario, operation) {
      let session
      let post
      if ((values.cpu || values.heap) && scenario === 'first-all') {
        session = new Session()
        session.connect()
        post = method => new Promise((resolve, reject) => session.post(method, (error, result) => error ? reject(error) : resolve(result)))
        if (values.cpu) {
          await post('Profiler.enable')
          await post('Profiler.start')
        }
        if (values.heap) {
          await post('HeapProfiler.enable')
          await post('HeapProfiler.collectGarbage')
          await post('HeapProfiler.startSampling')
        }
      }
      const memoryBefore = process.memoryUsage()
      let sampledPeakRss = memoryBefore.rss
      let sampledPeakHeapUsed = memoryBefore.heapUsed
      const start = performance.now()
      let lastTick = start
      let maxEventLoopDelayMs = 0
      let heartbeatTicks = 0
      function sample() {
        const now = performance.now()
        maxEventLoopDelayMs = Math.max(maxEventLoopDelayMs, now - lastTick - 10, 0)
        lastTick = now
        const memory = process.memoryUsage()
        sampledPeakRss = Math.max(sampledPeakRss, memory.rss)
        sampledPeakHeapUsed = Math.max(sampledPeakHeapUsed, memory.heapUsed)
      }
      const heartbeat = setInterval(() => {
        heartbeatTicks++
        sample()
      }, 10)
      const timer = new Promise(resolve => setTimeout(() => resolve(performance.now() - start), 0))
      phases = {}
      let result
      let durationMs
      try {
        result = await operation()
        durationMs = performance.now() - start
      }
      finally {
        sample()
        clearInterval(heartbeat)
        if (session) {
          if (values.cpu) {
            const { profile } = await post('Profiler.stop')
            const file = path.join(root, `cpu-${values.label}-${space}-${Date.now()}.cpuprofile`)
            fs.writeFileSync(file, JSON.stringify(profile))
            cpuProfiles.push(file)
          }
          if (values.heap) {
            await post('HeapProfiler.collectGarbage')
            const retainedMemory = process.memoryUsage()
            const { profile } = await post('HeapProfiler.stopSampling')
            const file = path.join(root, `heap-${values.label}-${space}-${Date.now()}.heapprofile`)
            fs.writeFileSync(file, JSON.stringify(profile))
            heapProfiles.push({ space, file, retainedMemory })
          }
          session.disconnect()
        }
      }
      const measuredPhases = phases
      phases = null
      const timerDelayMs = await timer
      rows.push({
        space,
        scenario,
        durationMs,
        timerDelayMs,
        maxEventLoopDelayMs,
        heartbeatTicks,
        memoryBefore,
        sampledPeakRss,
        sampledPeakHeapUsed,
        phases: measuredPhases,
        count: Array.isArray(result) ? result.length : undefined,
      })
      return result
    }
    async function measure(space, scenario, query, expected) {
      const result = await measureCall(space, scenario, () =>
        call('GET', `/${space}/?search=${encodeURIComponent(query)}`))
      assert.equal(result.length, expected, `${space}/${scenario}`)
    }
    for (const [space, key] of [
      ['snippets', 'code'],
      ['notes', 'notes'],
    ]) {
      const count = seed.counts[key]
      if (!count)
        continue
      // Дождаться фоновой сверки, не засчитывать provisional как полную библиотеку.
      const deadline = Date.now() + 120000
      for (;;) {
        const items = await call('GET', `/${space}/`)
        if (items.length === count)
          break
        if (Date.now() > deadline)
          throw new Error(`Incomplete ${space} library`)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      await measure(space, 'first-all', 'needle', count)
      await measure(space, 'repeat-all', 'needle', count)
      const items = await call('GET', `/${space}/`)
      await measure(space, 'selective', items[0].name, 1)
      await measure(space, 'no-hit', 'editedsearchsentinelxyz', 0)
      const candidate = recordIndex === undefined
        ? items[0]
        : items.find(item => item.name === `bench-${key}-${String(recordIndex).padStart(6, '0')}`)
      assert.ok(candidate, `Missing benchmark record ${key}/${recordIndex}`)
      const selected = await call('GET', `/${space}/${candidate.id}`)
      const endpoint
        = key === 'code'
          ? `/${space}/${selected.id}/contents/${selected.contents[0].id}`
          : `/${space}/${selected.id}/content`
      const field = key === 'code' ? 'value' : 'content'
      const original
        = key === 'code' ? selected.contents[0].value : selected.content
      editedContentChars[key] = original.length
      const sentinel = 'editedsearchsentinelxyz'
      try {
        await measureCall(space, 'edit', () =>
          call('PATCH', endpoint, { [field]: `${original}\n${sentinel}` }))
        await measure(space, 'after-edit', sentinel, 1)
        await measure(space, 'after-edit-repeat', sentinel, 1)
      }
      finally {
        await call('PATCH', endpoint, { [field]: original })
        const restored = await call('GET', `/${space}/${selected.id}`)
        const restoredContent
          = key === 'code'
            ? restored.contents.find(
              content => content.id === selected.contents[0].id,
            )?.value
            : restored.content
        assert.equal(
          restoredContent,
          original,
          `Failed to restore ${space}/${selected.id}`,
        )
        const restoredSearch = await call(
          'GET',
          `/${space}/?search=${sentinel}`,
        )
        assert.equal(
          restoredSearch.length,
          0,
          `Stale search after restoring ${space}`,
        )
      }
    }
    load(`${runtime}shared/stateWriter`).flushPendingStateWritesOrThrow()
    const result = {
      label: values.label,
      root,
      buildRoot,
      recordIndex,
      editedContentChars,
      cpuProfiles,
      heapProfiles,
      tokenModule,
      tokenSha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(tokenModule))
        .digest('hex'),
      counts: seed.counts,
      createdAt: new Date().toISOString(),
      rows,
      note: 'Headless real API; no renderer. Phase times overlap (read/parse are inside hydrate). OS cache not cleared. Edits restored, timestamps change. Timer delay is main event-loop probe, not UI latency.',
    }
    const destination = path.join(
      root,
      `search-${values.label}-${Date.now()}.json`,
    )
    fs.writeFileSync(destination, JSON.stringify(result, null, 2))
    console.log(destination)
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
