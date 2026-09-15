const assert = require('node:assert/strict')
const crypto = require('node:crypto')
// Запускать Electron: отдельный процесс для каждого A/B-прохода.
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const { parseArgs } = require('node:util')
const { app } = require('electron')
const { validateRoot } = require('./common.cjs')

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string' },
    tokens: { type: 'string' },
    label: { type: 'string', default: 'current' },
  },
})
if (!values.output || !/^[a-z0-9-]+$/i.test(values.label))
  throw new Error('Expected --output benchmark-root and a simple --label')
const { root, marker } = validateRoot(values.output)
const seed = JSON.parse(fs.readFileSync(path.join(root, 'seed.json'), 'utf8'))
app.setPath('userData', path.join(root, 'profile'))
app.setName('massCode search profile')
const load = relative => require(path.join(root, 'build/main', relative))
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
  || path.join(root, 'build/main', runtime, 'shared/searchIndex.js'),
)
load(`${runtime}shared/searchIndex`).buildSearchTokens
  = require(tokenModule).buildSearchTokens
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
instrument(load(`${runtime}parser`), 'splitFrontmatter', 'parseFrontmatter')
instrument(
  load(`${runtime}parser`),
  'parseBodyFragmentsWithMetadata',
  'parseFragments',
)
instrument(load(`${runtime}shared/searchEngine`), 'buildSearchIndex', 'index')
instrument(load(`${runtime}shared/searchEngine`), 'querySearchIndex', 'query')
const extraFs = require('fs-extra')

instrument(extraFs, 'readFileSync', 'readFiles')
const rows = []
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
    async function measure(space, scenario, query, expected) {
      const start = performance.now()
      // Таймер ставится до запроса: его задержка показывает занятость main,
      // но не является замером отрисовки или задержки ввода пользователя.
      const timer = new Promise(resolve =>
        setTimeout(() => resolve(performance.now() - start), 0),
      )
      phases = {}
      const result = await call(
        'GET',
        `/${space}/?search=${encodeURIComponent(query)}`,
      )
      const durationMs = performance.now() - start
      const measuredPhases = phases
      phases = null
      const timerDelayMs = await timer
      if (result.length !== expected) {
        throw new Error(
          `${space}/${scenario}: expected ${expected}, got ${result.length}`,
        )
      }
      rows.push({
        space,
        scenario,
        durationMs,
        timerDelayMs,
        phases: measuredPhases,
        count: result.length,
      })
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
      await measure(space, 'no-hit', 'absentsearchsentinelxyz', 0)
      const selected = await call('GET', `/${space}/${items[0].id}`)
      const endpoint
        = key === 'code'
          ? `/${space}/${selected.id}/contents/${selected.contents[0].id}`
          : `/${space}/${selected.id}/content`
      const field = key === 'code' ? 'value' : 'content'
      const original
        = key === 'code' ? selected.contents[0].value : selected.content
      const sentinel = 'editedsearchsentinelxyz'
      try {
        await call('PATCH', endpoint, { [field]: `${original}\n${sentinel}` })
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
        assert.equal(restoredContent, original, `Failed to restore ${space}/${selected.id}`)
      }
    }
    load(`${runtime}shared/stateWriter`).flushPendingStateWritesOrThrow()
    const result = {
      label: values.label,
      root,
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
