import type { HttpRuntime } from '../../../../shared/httpRuntime'
import type { HttpImportCollection } from '../types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { httpRuntimeSchema } from '../../../../shared/httpRuntime'
import { executeScript } from '../../scripts/execute'
import { parseOpenCollectionFiles } from '../opencollection'
import { parsePostmanFiles } from '../postman'
import { brunoScripts, buildImportedRuntime } from '../runtime'
import { brunoAssertions } from '../runtime/assertions'
import { translateScript } from '../runtime/scripts'
import { expandZipFiles } from '../zip'

function fixture(name: string) {
  return {
    name,
    content: readFileSync(join(__dirname, 'fixtures', name), 'utf8'),
  }
}
const response = {
  status: 200,
  body: '{"token":"demo-token","received":"collection/folder/request"}',
  bodyKind: 'text',
  truncated: false,
  headers: [],
  durationMs: 10,
}
async function execute(runtime: HttpRuntime) {
  const pre = await executeScript(
    runtime.scripts!.preRequest,
    { request: {}, response: null, variables: {} },
    new AbortController().signal,
  )
  const post = await executeScript(
    runtime.scripts!.postResponse,
    { request: {}, response, variables: pre.output?.variables ?? {} },
    new AbortController().signal,
  )
  return { pre, post }
}

async function executePostman(collection: HttpImportCollection, index: number) {
  const request = collection.requests[index]
  const folders = []
  let id = request.folderId
  while (id) {
    const folder = collection.folders.find(folder => folder.id === id)!
    folders.unshift(folder.collectionConfig!.runtime)
    id = folder.parentId
  }
  const scopes = [
    collection.collectionConfig!.runtime,
    ...folders,
    request.runtime,
  ]
  let variables: Record<string, string | null> = {}
  let pre: Awaited<ReturnType<typeof executeScript>> = { error: 'exception' }
  for (const scope of scopes) {
    pre = await executeScript(
      scope?.scripts?.preRequest ?? '',
      { request: {}, response: null, variables },
      new AbortController().signal,
    )
    variables = pre.output?.variables ?? variables
    if (pre.error)
      return { pre, post: pre }
  }
  const tests = []
  let post = pre
  for (const scope of scopes) {
    post = await executeScript(
      scope?.scripts?.postResponse ?? '',
      { request: {}, response, variables },
      new AbortController().signal,
    )
    variables = post.output?.variables ?? variables
    tests.push(...(post.output?.tests ?? []))
    if (post.error)
      break
  }
  return {
    pre,
    post: { ...post, output: { ...post.output, variables, tests } },
  }
}

it('supports scoped reads and passing/failing Postman status assertions', async () => {
  for (const status of [200, 201]) {
    const translated = translateScript(
      `pm.test("status", () => { pm.response.to.have.status(${status}); }); const value = pm.environment.get("x"); pm.variables.set("env", value); pm.variables.set("collection", pm.collectionVariables.get("x"));`,
      'postman',
      'postResponse',
    )
    const execution = await executeScript(
      translated.code!,
      {
        request: {},
        response,
        variables: { x: 'local' },
        environment: { x: 'env' },
        collectionVariables: { x: 'collection' },
      },
      new AbortController().signal,
    )
    expect(execution.error).toBeUndefined()
    expect(execution.output?.tests).toEqual([
      { name: 'status', ok: status === 200 },
    ])
    expect(execution.output?.variables).toMatchObject({
      env: 'env',
      collection: 'collection',
    })
  }
})

describe('imported scripts in the actual isolated runtime', () => {
  it('preserves inherited scripts from a real Postman 12.26.5 v2.1 export', async () => {
    const collection = parsePostmanFiles([
      fixture('exports/postman-12.26.5.json'),
    ]).collections[0]
    const requests = collection.requests
    const expected = parsePostmanFiles([
      fixture('postman-scripts.json'),
    ]).collections[0].requests.slice(0, 2)
    expect(requests).toHaveLength(2)
    expect(requests.map(request => request.runtime)).toEqual(
      expected.map(request => request.runtime),
    )
    expect(requests.map(request => request.scriptStatus)).toEqual([
      'converted',
      'converted',
    ])
    const { pre, post } = await executePostman(collection, 0)
    expect(pre.output?.variables.order).toBe('collection/folder/request')
    expect(post.error).toBeUndefined()
    expect(post.output?.variables.token).toBe('demo-token')
    expect(post.output?.tests).toEqual(
      ['Collection status', 'Token', 'Inherited setup'].map(name => ({
        name,
        ok: true,
      })),
    )
    expect(
      (await executePostman(collection, 1)).post.output?.tests,
    ).toContainEqual({ name: 'Intentional failure', ok: false })
  })

  it.each(['yml', 'zip'])(
    'preserves scripts and assertions from a real Bruno 3.3.0 %s export',
    async (extension) => {
      const name = `exports/bruno-3.3.0.${extension}`
      const files
        = extension === 'zip'
          ? await expandZipFiles([
            {
              name,
              content: readFileSync(
                join(__dirname, 'fixtures', name),
              ).toString('base64'),
              encoding: 'base64',
            },
          ])
          : [fixture(name)]
      const requests = parseOpenCollectionFiles(files).collections[0].requests
      const expected = parseOpenCollectionFiles([
        fixture('bruno-scripts.yml'),
      ]).collections[0].requests.slice(0, 2)
      expect(requests).toHaveLength(2)
      expect(requests.map(request => request.runtime)).toEqual(
        expected.map(request => request.runtime),
      )
      expect(requests.map(request => request.scriptStatus)).toEqual([
        'converted',
        'converted',
      ])
      const { pre, post } = await execute(requests[0].runtime!)
      expect(pre.output?.variables.order).toBe('collection/folder/request')
      expect(post.error).toBeUndefined()
      expect(post.output?.variables.token).toBe('demo-token')
      expect(post.output?.tests).toEqual(
        [
          'Request test',
          'Sandwich order',
          'Folder test',
          'Collection test',
        ].map(name => ({ name, ok: true })),
      )
      expect(
        (await execute(requests[1].runtime!)).post.output?.tests,
      ).toContainEqual({ name: 'Intentional failure', ok: false })
    },
  )

  it.each(['postman', 'bruno'])(
    'runs %s inherited pre/post scripts and passing/failing JS tests',
    async (dialect) => {
      const result
        = dialect === 'postman'
          ? parsePostmanFiles([fixture('postman-scripts.json')])
          : parseOpenCollectionFiles([fixture('bruno-scripts.yml')])
      const [passing, failing, blocked, malformed]
        = result.collections[0].requests
      expect(passing.scriptStatus).toBe('converted')
      expect(httpRuntimeSchema.safeParse(passing.runtime).success).toBe(true)
      const { pre, post }
        = dialect === 'postman'
          ? await executePostman(result.collections[0], 0)
          : await execute(passing.runtime!)
      expect(pre.output?.variables.order).toBe('collection/folder/request')
      expect(post.error).toBeUndefined()
      expect(post.output?.variables.token).toBe('demo-token')
      expect(post.output?.tests.every(test => test.ok)).toBe(true)
      if (dialect === 'bruno') {
        expect(post.output?.tests.map(test => test.name)).toEqual([
          'Request test',
          'Sandwich order',
          'Folder test',
          'Collection test',
        ])
        expect(passing.runtime?.assertions).toHaveLength(3)
      }
      expect(
        (await execute(failing.runtime!)).post.output?.tests,
      ).toContainEqual({ name: 'Intentional failure', ok: false })
      for (const request of [blocked, malformed]) {
        expect(request.scriptStatus).toBe('blocked')
        expect((await execute(request.runtime!)).pre.error).toBe('exception')
      }
      expect(JSON.stringify(result.warnings)).not.toContain(
        'do-not-print-secret',
      )
    },
  )

  it('uses the selected Bruno order for both post scripts and tests', () => {
    const scopes = ['collection', 'folder', 'request'].map(source => ({
      source,
      raw: {
        scripts: [
          { type: 'before-request', code: `${source}-pre` },
          { type: 'after-response', code: `${source}-post` },
          { type: 'tests', code: `${source}-test` },
        ],
      },
    }))
    expect(brunoScripts(scopes, true).map(script => script.code)).toEqual([
      'collection-pre',
      'folder-pre',
      'request-pre',
      'collection-post',
      'folder-post',
      'request-post',
      'collection-test',
      'folder-test',
      'request-test',
    ])
  })

  it('inherits scripts from on-disk folder files, regardless of input order', () => {
    const files = [
      {
        name: 'demo/folder/request.yml',
        content:
          'info: {name: Request, type: http}\nhttp: {method: GET, url: https://example.test}',
      },
      {
        name: 'demo/opencollection.yml',
        content:
          'info: {name: Demo}\nrequest:\n  scripts:\n    - type: before-request\n      code: bru.setVar("order", "root");',
      },
      {
        name: 'demo/folder/folder.yml',
        content:
          'info: {name: Folder, type: folder}\nrequest:\n  scripts:\n    - type: before-request\n      code: bru.setVar("order", "folder");',
      },
    ]
    const request = parseOpenCollectionFiles(files).collections[0].requests[0]
    expect(request.runtime?.scripts?.preRequest.indexOf('"root"')).toBeLessThan(
      request.runtime!.scripts!.preRequest.indexOf('"folder"'),
    )
  })

  it.each([
    'pm.sendRequest("https://example.test")',
    'pm.environment.set("x", "secret")',
    'pm.test("async", async () => {})',
    'pm.test("done", (done) => {})',
    'const pm = {};',
    'const x = pm.response.json(); x.token = "changed";',
    'eval("anything")',
    'const x = globalThis.process;',
    'const x = pm.response.json()["constructor"];',
    'pm.test("deep", () => { pm.expect(pm.response.json()).to.deep.equal({}); });',
    'while (true) {}',
    'pm.test(',
    'const n = 1e400;',
    'const status = pm["response.code"];',
    'pm["variables.set"]("x", "1");',
    'pm.test("mutation", () => { pm.expect(pm.variables.set("x", "1")).to.above(1); });',
  ])('rejects unsupported source without evaluating it: %s', (source) => {
    expect(() => translateScript(source, 'postman', 'postResponse')).toThrow()
  })

  it('keeps strings unchanged and blocks the entire inherited script set', async () => {
    const source = 'pm.variables.set("x", "pm.response.code /* */");'
    expect(translateScript(source, 'postman', 'preRequest').code).toContain(
      '"pm.response.code /* */"',
    )
    const imported = buildImportedRuntime(
      [
        { source: 'root', phase: 'preRequest', code: source },
        {
          source: 'child',
          phase: 'postResponse',
          code: '*/\nmc.variables.set("escaped", "bad");\u2028boom',
        },
      ],
      'postman',
      'child',
      [],
    )
    const result = await execute(imported.runtime!)
    expect(result.pre.error).toBe('exception')
    expect(imported.runtime!.scripts!.postResponse).toBe('')
  })

  it('enforces script size and does not grant trust from imported data', () => {
    const raw = JSON.parse(fixture('postman-scripts.json').content)
    raw.trusted = true
    raw.event[0].script.exec = 'x'.repeat(70_000)
    const result = parsePostmanFiles([
      { name: 'large.json', content: JSON.stringify(raw) },
    ])
    const request = result.collections[0].requests[0]
    expect(request.scriptStatus).toBe('blocked')
    expect(request.runtime!.scripts!.preRequest.length).toBeLessThan(65536)
    expect(JSON.stringify(request.runtime)).not.toContain('trusted')
  })
})

describe('declarative assertion conversion', () => {
  it('preserves literal types and escaped JSON Pointer paths without executing expressions', () => {
    const warnings: { source: string, message: string }[] = []
    const rules = brunoAssertions(
      [
        { expression: 'res.status', operator: 'eq', value: '200' },
        {
          expression: 'res.body["a/b"]["~"][0].ok',
          operator: 'eq',
          value: 'true',
        },
        { expression: 'res.body.token', operator: 'eq', value: '"001"' },
        { expression: 'res.body.token', operator: 'eq', value: `\${danger()}` },
        { expression: 'res.body; danger()', operator: 'eq', value: '200' },
        {
          expression: 'res.status',
          operator: 'eq',
          value: '200',
          disabled: true,
        },
      ],
      'request',
      warnings,
    )
    expect(rules.map(rule => rule.expected)).toEqual([200, true, '001'])
    expect(rules[1].path).toBe('/a~1b/~0/0/ok')
    expect(warnings).toHaveLength(3)
  })
})

describe('damaged and oversized input', () => {
  it('rejects excess requests before persistence', () => {
    const raw = {
      info: { name: 'Limit', schema: 'postman' },
      item: Array.from({ length: 1001 }, (_, index) => ({
        name: String(index),
        request: { method: 'GET', url: 'https://example.test' },
      })),
    }
    expect(() =>
      parsePostmanFiles([{ name: 'limit.json', content: JSON.stringify(raw) }]),
    ).toThrow('fileLimit')
  })
  it('blocks excess inherited script blocks before translation', () => {
    const result = buildImportedRuntime(
      Array.from({ length: 101 }, () => ({
        source: 'root',
        code: 'pm.variables.set("x", "1");',
        phase: 'preRequest' as const,
      })),
      'postman',
      'root',
      [],
    )
    expect(result.scriptStatus).toBe('blocked')
    expect(result.runtime?.scripts?.preRequest.length).toBeLessThan(256)
  })
  it('rejects recursive YAML aliases and retains the warning', () => {
    const result = parseOpenCollectionFiles([
      {
        name: 'opencollection.yml',
        content: 'items: &items\n  - items: *items',
      },
    ])
    expect(result.collections).toEqual([])
    expect(result.warnings).not.toEqual([])
  })
  it('rejects excessive files and zip expansion', async () => {
    expect(() =>
      parsePostmanFiles([
        { name: 'large.json', content: ' '.repeat(2 * 1024 * 1024 + 1) },
      ]),
    ).toThrow('fileLimit')
    const zip = new JSZip()
    zip.file('large.yml', ' '.repeat(2 * 1024 * 1024 + 1))
    await expect(
      expandZipFiles([
        {
          name: 'bomb.zip',
          encoding: 'base64',
          content: await zip.generateAsync({
            type: 'base64',
            compression: 'DEFLATE',
          }),
        },
      ]),
    ).rejects.toThrow('invalidArchive')
  })
})
