import { describe, expect, it } from 'vitest'
import {
  applyHttpCollection,
  collectionVariables,
  emptyHttpCollection,
  findHttpCollection,
  httpCollectionSchema,
  mergeHttpCollectionRuntime,
  readHttpCollection,
  resolveHttpFolderConfig,
} from '../httpCollection'
import { emptyHttpRuntime } from '../httpRuntime'

const request = {
  headers: [
    { key: 'X-Mode', value: 'request' },
    { key: 'X-Keep', value: 'disabled', enabled: false },
  ],
  auth: { type: 'inherit' as const },
}

describe('hTTP collection settings', () => {
  it('merges enabled headers case-insensitively and preserves collection headers under disabled request rows', () => {
    const config = emptyHttpCollection()
    config.headers = [
      { key: 'x-mode', value: 'collection' },
      { key: 'x-keep', value: 'kept' },
      { key: 'X-Off', value: 'off', enabled: false },
    ]
    expect(applyHttpCollection(request, config).headers).toEqual([
      { key: 'X-Mode', value: 'request' },
      { key: 'x-keep', value: 'kept' },
    ])
    expect(config.headers[0].value).toBe('collection')
  })

  it('inherits auth only when explicit, retaining legacy none and request credentials', () => {
    const config = emptyHttpCollection()
    config.auth = { type: 'bearer', token: '{{token}}' }
    expect(applyHttpCollection(request, config).auth).toEqual(config.auth)
    expect(
      applyHttpCollection({ ...request, auth: { type: 'none' } }, config).auth,
    ).toEqual({ type: 'none' })
    expect(
      applyHttpCollection(
        { ...request, auth: { type: 'basic', username: 'local' } },
        config,
      ).auth,
    ).toEqual({ type: 'basic', username: 'local' })
    expect(applyHttpCollection(request).auth).toEqual({ type: 'none' })
  })

  it('exports enabled variables and validates duplicate or unsafe variable names', () => {
    const config = emptyHttpCollection()
    config.variables = [
      { key: 'token', value: 'collection' },
      { key: 'disabled', value: 'off', enabled: false },
    ]
    expect(collectionVariables(config)).toEqual({ token: 'collection' })
    config.variables.push({ key: 'token', value: 'duplicate' })
    expect(httpCollectionSchema.safeParse(config).success).toBe(false)
    config.variables = [{ key: '__proto__', value: 'unsafe' }]
    expect(httpCollectionSchema.safeParse(config).success).toBe(false)
  })

  it('finds the collection above nested folders and rejects cycles', () => {
    const root = {
      id: 1,
      parentId: null,
      collectionConfig: emptyHttpCollection(),
    }
    expect(findHttpCollection([root, { id: 2, parentId: 1 }], 2)).toBe(root)
    expect(findHttpCollection([], null)).toBeUndefined()
    expect(() =>
      findHttpCollection(
        [
          { id: 1, parentId: 2 },
          { id: 2, parentId: 1 },
        ],
        1,
      ),
    ).toThrow('HTTP_COLLECTION_INVALID')
    expect(
      findHttpCollection(
        [root, { id: 2, parentId: 1, collectionConfig: emptyHttpCollection() }],
        2,
      ),
    ).toBe(root)
  })

  it('inherits settings through nested folders and applies closest overrides', () => {
    const root = emptyHttpCollection()
    root.auth = { type: 'bearer', token: 'root' }
    root.headers = [{ key: 'X-Mode', value: 'root' }]
    root.variables = [{ key: 'host', value: 'root' }]
    root.runtime.extractions = [
      { name: 'token', source: 'header', path: 'root' },
    ]
    const child = emptyHttpCollection()
    child.auth = { type: 'inherit' }
    child.headers = [{ key: 'x-mode', value: 'child' }]
    child.variables = [{ key: 'host', value: 'child' }]
    child.runtime.extractions = [
      { name: 'token', source: 'header', path: 'child' },
    ]
    const folders = [
      { id: 1, parentId: null, collectionConfig: root },
      { id: 2, parentId: 1, collectionConfig: child },
      { id: 3, parentId: 2 },
    ]
    const resolved = resolveHttpFolderConfig(folders, 3)!
    expect(resolved.auth).toEqual(root.auth)
    expect(resolved.headers).toEqual(child.headers)
    expect(collectionVariables(resolved)).toEqual({ host: 'child' })
    expect(resolved.runtime.extractions).toEqual(child.runtime.extractions)
    expect(applyHttpCollection(request, resolved).headers[0].value).toBe(
      'request',
    )
    child.auth = { type: 'none' }
    expect(resolveHttpFolderConfig(folders, 3)?.auth).toEqual({ type: 'none' })
    expect(root.headers[0].value).toBe('root')
  })

  it('keeps legacy folders usable and blocks malformed synced configuration', () => {
    expect(readHttpCollection({ id: 1, parentId: null })).toBeUndefined()
    expect(() =>
      readHttpCollection({
        id: 1,
        parentId: null,
        collectionConfig: { version: 99 },
      }),
    ).toThrow('HTTP_COLLECTION_INVALID')
    expect(() =>
      readHttpCollection({
        id: 1,
        parentId: null,
        collectionConfig: null,
        collectionConfigState: 'invalid',
      }),
    ).toThrow('HTTP_COLLECTION_INVALID')
  })

  it('combines rules with request extraction precedence and refuses overflow instead of truncating', () => {
    const collection = emptyHttpRuntime()
    collection.extractions = [
      { name: 'token', source: 'header', path: 'old' },
      { name: 'other', source: 'json', path: '/other' },
    ]
    collection.assertions = [
      {
        name: 'collection status',
        source: 'status',
        operator: 'eq',
        expected: 200,
      },
    ]
    const local = emptyHttpRuntime()
    local.extractions = [{ name: 'token', source: 'json', path: '/token' }]
    local.assertions = [
      {
        name: 'request status',
        source: 'status',
        operator: 'eq',
        expected: 200,
      },
    ]
    const result = mergeHttpCollectionRuntime(local, collection)
    expect(result.extractions).toEqual([
      collection.extractions[1],
      local.extractions[0],
    ])
    expect(result.assertions.map(rule => rule.name)).toEqual([
      'collection status',
      'request status',
    ])
    collection.assertions = Array.from(
      { length: 100 },
      () => collection.assertions[0],
    )
    expect(() => mergeHttpCollectionRuntime(local, collection)).toThrow(
      'HTTP_COLLECTION_RULE_LIMIT',
    )
  })
})
