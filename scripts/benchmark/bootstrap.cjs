const { Buffer } = require('node:buffer')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const { app } = require('electron')
const { validateRoot, documentFor } = require('./common.cjs')

const mode = process.argv[2]
const { root, marker } = validateRoot(process.argv[3])
app.setPath('userData', path.join(root, 'profile'))
app.setName('massCode BENCHMARK')
process.env.MASSCODE_BENCHMARK_ROOT = root
process.env.MASSCODE_BENCHMARK_STARTED = String(performance.now())
const load = relative => require(path.join(root, 'build/main', relative))
const { store } = load('store')
if (store.preferences.get('storage.vaultPath') !== path.join(root, 'vault') || store.preferences.get('storage.rootPath') !== path.join(root, 'vault') || app.getPath('userData') !== path.join(root, 'profile'))
  throw new Error('Benchmark profile isolation mismatch')
if (mode === 'start') {
  app.on('browser-window-created', (_event, window) => {
    window.setTitle('massCode BENCHMARK')
    window.on('page-title-updated', event => event.preventDefault())
  })
  load('index')
}
else if (mode === 'seed') {
  app.whenReady().then(async () => {
    if (fs.readdirSync(path.join(root, 'vault')).length)
      throw new Error('Refusing to seed a nonempty vault')
    const token = crypto.randomUUID()
    const api = load('api/app').createApiApp({ port: marker.port, sessionToken: token, version: app.getVersion() })
    const call = async (method, endpoint, body) => {
      const response = await api.handle(new Request(`http://127.0.0.1:${marker.port}${endpoint}`, { method, headers: { 'host': `127.0.0.1:${marker.port}`, 'authorization': `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
      if (!response.ok)
        throw new Error(`${method} ${endpoint}: ${response.status} ${await response.text()}`)
      return response.json()
    }
    const counts = { code: 0, notes: 0, http: 0 }
    const hash = crypto.createHash('sha256')
    let contentBytes = 0
    for (let index = 0; index < marker.count * (marker.space === 'all' ? 3 : 1); index++) {
      const space = marker.space === 'all' ? ['code', 'notes', 'http'][index % 3] : marker.space === 'mixed' ? (index % 10 < 6 ? 'code' : index % 10 < 9 ? 'notes' : 'http') : marker.space
      const { name, body, language } = documentFor(marker.seed, marker.space === 'all' ? Math.floor(index / 3) : index, space, marker.corpus)
      const route = { code: 'snippets', notes: 'notes', http: 'http-requests' }[space]
      const { id } = await call('POST', `/${route}/`, { name, ...(space === 'http' ? { method: 'POST', url: 'http://127.0.0.1:5191/echo' } : {}) })
      let expected
      if (space === 'code') {
        expected = [0, 1, 2].map(fragment => `${body}\nexport const fragment = ${fragment}\n`)
        for (const [fragment, value] of expected.entries())
          await call('POST', `/snippets/${id}/contents`, { label: `Fragment ${fragment + 1}`, language: language || 'typescript', value })
      }
      else if (space === 'notes') {
        expected = `# ${name}\n\n${body}\n\n\x60\x60\x60typescript\nconst benchmark = true\n\x60\x60\x60\n`
        await call('PATCH', `/notes/${id}/content`, { content: expected })
      }
      else {
        expected = JSON.stringify({ benchmark: name, payload: body })
        await call('PATCH', `/http-requests/${id}`, { bodyType: 'json', body: expected })
      }
      const readback = await call('GET', `/${route}/${id}`)
      const actual = space === 'code' ? readback.contents.map(content => content.value) : space === 'notes' ? readback.content : readback.body
      if (JSON.stringify(expected) !== JSON.stringify(actual))
        throw new Error(`Seed readback mismatch: ${space} ${index}`)
      const serialized = JSON.stringify({ name, content: expected })
      hash.update(serialized)
      contentBytes += Buffer.byteLength(serialized)
      counts[space]++
    }
    for (const [space, route] of Object.entries({ code: 'snippets', notes: 'notes', http: 'http-requests' })) {
      const items = await call('GET', `/${route}/`)
      if (items.length !== counts[space])
        throw new Error(`Seed count mismatch: ${space}`)
    }
    load('storage/providers/markdown/runtime/shared/stateWriter').flushPendingStateWritesOrThrow()
    fs.writeFileSync(path.join(root, 'seed.json'), JSON.stringify({ counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0), contentBytes, contentSha256: hash.digest('hex'), seed: marker.seed, corpus: marker.corpus || 'repeated', note: 'Content deterministic; storage UUIDs and timestamps are not.' }, null, 2))
    app.exit(0)
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })
}
else {
  throw new Error('Expected start or seed')
}
