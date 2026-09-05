import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import process from 'node:process'

const base = 'http://127.0.0.1:5189'
const demoCases = [
  [
    '01 · Variables and tests',
    'mc.variables.set("demoValue", "from-pre")',
    'mc.test("status", () => mc.assert(mc.response.status === 200));\nconst body = JSON.parse(mc.response.body);\nmc.test("pre-request body", () => mc.assert(body.received === "from-pre"));\nmc.test("extraction before post", () => mc.assert(mc.variables.get("demoToken") === "demo-token"));\nmc.variables.set("demoNext", "ready")',
    'First Send must be blocked. Review both scripts and trust them, then Send: three tests pass. Save, run the folder with step 02, and inspect the results. Edit pre-request without saving: trust must be invalidated.',
  ],
  [
    '02 · Runner session',
    '',
    'mc.test("previous step", () => mc.assert(mc.variables.get("demoNext") === "ready"))',
    'Trust this code. In Folder Runner after step 01 this passes. Alone in a fresh manual Session it fails. Runner must not write demoNext into manual Session.',
  ],
  [
    '03 · Test failure',
    '',
    'mc.test("intentional failure", () => mc.assert(false)); mc.variables.set("mustNotCommit", "no")',
    'After trust and Send, HTTP 200 remains visible, JS test fails, mustNotCommit must not appear in Variables inspector. Runner stops unless Continue on failure is enabled.',
  ],
  [
    '04 · Script exception',
    'throw new Error("demo-hidden-message")',
    '',
    'After trust and Send, execution fails before HTTP. Tests shows a generic exception message; demo-hidden-message must not be shown. Replace with mc.assert(true), trust again and retry to recover.',
  ],
  [
    '05 · Time limit',
    'while (true) {}',
    '',
    'After trust and Send, execution stops at the script deadline. UI must stay responsive. Use Cancel request during execution. Then run step 01 again to verify recovery.',
  ],
  [
    '06 · Memory limit',
    'const values = []; while (true) values.push(new Array(100000).fill(1))',
    '',
    'After trust and Send, allocation fails or the watchdog stops the worker. The app must remain responsive and step 01 must work afterwards.',
  ],
  [
    '07 · Output limit',
    'for (let i = 0; i < 200; i++) { try { mc.variables.set("key" + i, "value") } catch {} }',
    '',
    'After trust and Send, the output limit fails even though the script catches exceptions. No key variables should commit.',
  ],
  [
    '08 · Isolation',
    'mc.test("isolated", () => { for (const name of ["process", "require", "fetch", "WebSocket", "XMLHttpRequest", "Buffer", "electron", "console"]) mc.assert(typeof globalThis[name] === "undefined"); mc.assert(mc.variables.get.constructor("return typeof process")() === "undefined") })',
    '',
    'After trust and Send the isolation test passes. Revoke trust and Send again: execution must be blocked before HTTP.',
  ],
]

async function seed() {
  const api = 'http://127.0.0.1:4321'
  async function call(path, method = 'GET', body) {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.MASSCODE_API_TOKEN
          ? { Authorization: `Bearer ${process.env.MASSCODE_API_TOKEN}` }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok)
      throw new Error(`${method} ${path}: ${response.status}`)
    return response.json()
  }
  if (!process.env.MASSCODE_API_TOKEN) {
    throw new Error(
      'Set MASSCODE_API_TOKEN to the development session token configured when starting dev, or use the authenticated in-app seeder.',
    )
  }
  const schema = await call('/swagger/json')
  if (!JSON.stringify(schema).includes('preRequest'))
    throw new Error('Start the updated dev app first')
  const folder = await call('/http-folders', 'POST', {
    name: `Demo · Scripts ${Date.now()}`,
  })
  const created = []
  for (const [name, preRequest, postResponse, instructions] of demoCases) {
    const { id } = await call('/http-requests', 'POST', {
      name,
      folderId: folder.id,
      method: 'POST',
      url: `${base}/echo`,
    })
    await call(`/http-requests/${id}`, 'PATCH', {
      bodyType: 'text',
      body: '{{demoValue}}',
      description: `# HTTP Scripts demo\n\nStart the local server: node scripts/http-scripts-demo.mjs\n\nUse no environment for these demos. Scripts never receive trust from this seeder.\n\n${instructions}\n\nExpected server: ${base}/echo. The server returns token demo-token and echoes the body. It stores no data.\n`,
    })
    const request = await call(`/http-requests/${id}`)
    await call(`/http-requests/${id}/runtime`, 'PUT', {
      expectedRevision: request.runtimeRevision,
      runtime: {
        version: 2,
        scripts: { preRequest, postResponse },
        extractions: [{ name: 'demoToken', source: 'json', path: '/token' }],
        assertions: [
          { name: 'HTTP 200', source: 'status', operator: 'eq', expected: 200 },
        ],
      },
    })
    created.push({ id, name })
  }
  console.log(JSON.stringify({ folderId: folder.id, created }, null, 2))
}

if (process.argv.includes('--seed')) {
  await seed()
}
else {
  const server = createServer(async (request, response) => {
    if (request.url === '/seed.mjs') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript',
        'Access-Control-Allow-Origin': 'http://localhost:5177',
      })
      response.end(
        readFileSync(new URL('./http-scripts-seed.mjs', import.meta.url)),
      )
      return
    }
    if (request.url === '/fixtures') {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5177',
      })
      response.end(JSON.stringify(demoCases))
      return
    }
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ demo: 'masscode-http-scripts' }))
      return
    }
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (body.length > 65536) {
        response.writeHead(413)
        response.end()
        return
      }
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ token: 'demo-token', received: body }))
  })
  server.on('error', (error) => {
    console.error(error.code)
    process.exitCode = 1
  })
  server.listen(5189, '127.0.0.1', () => console.log(`Scripts demo: ${base}`))
}
