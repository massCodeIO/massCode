import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import fs from 'fs-extra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { workspaceCreationHistory } from '../../../shared/aiWorkspace'
import {
  emptyHttpCollection,
  httpCollectionSchema,
  resolveHttpFolderConfig,
} from '../../../shared/httpCollection'
import { emptyHttpRuntime } from '../../../shared/httpRuntime'
import { useHttpStorage } from '../../storage'
import { getHttpPaths } from '../../storage/providers/markdown/http/runtime/paths'
import { ensureHttpStateFile } from '../../storage/providers/markdown/http/runtime/state'
import { resetHttpRuntimeCache } from '../../storage/providers/markdown/http/runtime/sync'
import { getNotesPaths } from '../../storage/providers/markdown/notes/runtime/constants'
import { ensureNotesStateFile } from '../../storage/providers/markdown/notes/runtime/state'
import { resetNotesRuntimeCache } from '../../storage/providers/markdown/notes/runtime/sync'
import { getPaths } from '../../storage/providers/markdown/runtime/paths'
import { ensureStateFile } from '../../storage/providers/markdown/runtime/state'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { createWorkspaceManager } from '../workspace'
import { creationPlan } from '../workspaceCreation'
import { readHttpState, workspaceInventory } from '../workspaceTools'

let tempVaultPath = ''
vi.mock('electron-store', () => {
  class MockStore {
    private state: Record<string, unknown>

    constructor(options?: { defaults?: Record<string, unknown> }) {
      this.state = { ...(options?.defaults || {}) }
    }

    get(key?: string): unknown {
      if (!key) {
        return this.state
      }

      return key.split('.').reduce<unknown>((acc, segment) => {
        if (!acc || typeof acc !== 'object') {
          return undefined
        }

        return (acc as Record<string, unknown>)[segment]
      }, this.state)
    }

    set(key: string, value: unknown): void {
      const segments = key.split('.')
      let cursor: Record<string, unknown> = this.state

      for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index]
        const next = cursor[segment]

        if (!next || typeof next !== 'object') {
          cursor[segment] = {}
        }

        cursor = cursor[segment] as Record<string, unknown>
      }

      cursor[segments[segments.length - 1]] = value
    }
  }

  return { default: MockStore }
})

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  app: {
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: (key: string) => {
        if (key === 'http') {
          return {
            historyLimit: 0,
            transport: {},
            skipCertificateVerification: false,
          }
        }
        if (key === 'storage.vaultPath') {
          return tempVaultPath
        }

        return undefined
      },
    },
  },
}))

vi.mock('../vault', () => ({ vaultIdentity: () => tempVaultPath }))
beforeEach(() => {
  tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-lifecycle-'))
  resetHttpRuntimeCache()
  resetRuntimeCache()
  resetNotesRuntimeCache()
  ensureHttpStateFile(getHttpPaths(tempVaultPath))
  ensureStateFile(getPaths(tempVaultPath))
  ensureNotesStateFile(getNotesPaths(tempVaultPath))
})
afterEach(() => {
  resetHttpRuntimeCache()
  resetRuntimeCache()
  resetNotesRuntimeCache()
  fs.removeSync(tempVaultPath)
})

const secrets = vi.hoisted(() => ({
  usable: vi.fn(() => ['TOKEN']),
  remove: vi.fn(),
}))
vi.mock('../../http/secrets', () => ({
  getEnvironmentSecrets: () => ({}),
  getUsableSecretKeys: secrets.usable,
  deleteEnvironmentSecrets: secrets.remove,
}))
function plan(operations: unknown[]) {
  return { summary: 'HTTP data changes', operations }
}
function op(kind: string, action: string, id: number | undefined, fields = {}) {
  return {
    space: 'http',
    kind,
    action,
    ...(id === undefined ? {} : { id }),
    fields,
  }
}
function apply(operation: unknown) {
  const manager = createWorkspaceManager()
  const proposal = manager.propose(plan([operation]))
  const result = manager.apply(proposal.id, [0])
  expect(result.failed).toBeUndefined()
  return { manager, proposal, result }
}
it('keeps the native creation suffix when a trashed HTTP request occupies the requested path', () => {
  const db = useHttpStorage().requests
  const trashedId = db.createRequest({ name: 'Socket' }).id
  db.updateRequest(trashedId, { isDeleted: 1 })
  const trashed = structuredClone(db.getRequestById(trashedId))
  const originalPath = path.join(tempVaultPath, 'http', 'Socket.md')
  const originalFile = fs.readFileSync(originalPath, 'utf8')
  const manager = createWorkspaceManager()
  const result = manager.create(
    creationPlan({
      summary: 'Create socket',
      items: [
        {
          type: 'http_request',
          name: 'Socket',
          protocol: 'websocket',
          method: 'GET',
          url: 'wss://example.test/socket',
          description: 'Socket description',
          headers: [{ key: 'X-Test', value: 'preserved', enabled: true }],
        },
      ],
    }),
  )
  expect(result.failed).toBeUndefined()
  expect(result.items).toHaveLength(1)
  const created = result.items[0]!
  expect(created.name).toBe('Socket 1')
  expect(created.requestedName).toBe('Socket')
  const history = workspaceCreationHistory({ ...result, undone: [] })
  expect(history.created[0]).toMatchObject({
    name: 'Socket 1',
    requestedName: 'Socket',
  })
  expect(history.nameAllocationNote).toContain('Native storage allocated')
  expect(history.nameAllocationNote).not.toContain('collision')
  expect(db.getRequestById(created.id)).toMatchObject({
    name: 'Socket 1',
    protocol: 'websocket',
    method: 'GET',
    url: 'wss://example.test/socket',
    description: 'Socket description',
    headers: [{ key: 'X-Test', value: 'preserved', enabled: true }],
    isDeleted: 0,
  })
  expect(fs.existsSync(path.join(tempVaultPath, 'http', 'Socket 1.md'))).toBe(
    true,
  )
  expect(fs.existsSync(path.join(tempVaultPath, 'http', 'Socket 2.md'))).toBe(
    false,
  )
  expect(result.proposal.changes[0]).toMatchObject({
    name: 'Socket 1',
    operation: { fields: { name: 'Socket 1' } },
  })
  expect(JSON.parse(result.proposal.changes[0]!.after).name).toBe('Socket 1')
  expect(db.getRequestById(trashedId)).toEqual(trashed)
  expect(fs.readFileSync(originalPath, 'utf8')).toBe(originalFile)
  manager.undo(result.proposal.id, 0)
  expect(db.getRequestById(created.id)).toMatchObject({
    name: 'Socket 1',
    isDeleted: 1,
  })
  expect(db.getRequestById(trashedId)).toEqual(trashed)
  expect(fs.readFileSync(originalPath, 'utf8')).toBe(originalFile)
})

it('omits name allocation provenance when native creation preserves the requested name', () => {
  const result = createWorkspaceManager().create(
    creationPlan({
      summary: 'Create request and folder',
      items: [
        { type: 'folder', space: 'http', name: 'Requests' },
        {
          type: 'http_request',
          name: 'Request',
          method: 'GET',
          url: 'https://example.test',
          folderOperation: 0,
        },
      ],
    }),
  )
  expect(result.failed).toBeUndefined()
  const history = workspaceCreationHistory({ ...result, undone: [] })
  expect(history.created[0]).toMatchObject({ name: 'Request' })
  expect(history.containers[0]).toMatchObject({ name: 'Requests' })
  expect(history.created[0]).not.toHaveProperty('requestedName')
  expect(history.containers[0]).not.toHaveProperty('requestedName')
  expect(history).not.toHaveProperty('nameAllocationNote')
})

it('undoes a new collection after only its sidebar expansion changes', () => {
  const manager = createWorkspaceManager()
  const result = manager.create(
    creationPlan({
      summary: 'Create collection',
      items: [{ type: 'http_collection', name: 'Orders' }],
    }),
  )
  expect(result.failed).toBeUndefined()
  const folderId = result.containers[0]!.id
  useHttpStorage().folders.updateFolder(folderId, { isOpen: 1 })
  resetHttpRuntimeCache()
  expect(manager.undo(result.proposal.id, 0)).toBe(true)
  expect(
    useHttpStorage()
      .folders.getFolders()
      .some(folder => folder.id === folderId),
  ).toBe(false)
})

it('undoes an expanded new collection after its requests, preserving manually edited folders and children', () => {
  const db = useHttpStorage()
  const manager = createWorkspaceManager()
  const result = manager.create(
    creationPlan({
      summary: 'Create collection',
      items: [
        { type: 'http_collection', name: 'Orders' },
        {
          type: 'http_request',
          name: 'Get order',
          method: 'GET',
          url: 'https://example.test/orders',
          folderOperation: 0,
        },
      ],
    }),
  )
  expect(result.failed).toBeUndefined()
  const folderId = result.containers[0]!.id
  const readFolder = () =>
    db.folders.getFolders().find(folder => folder.id === folderId)
  const original = structuredClone(readFolder()!)
  expect(original.isOpen).toBe(0)
  db.folders.updateFolder(folderId, { isOpen: 1 })
  expect(manager.undo(result.proposal.id, 1)).toBe(true)
  expect(db.requests.getRequestById(result.items[0]!.id)).toMatchObject({
    isDeleted: 1,
    folderId: null,
  })

  for (const metadata of [
    { name: 'Manual' },
    { icon: 'manual-icon' },
    {
      collectionConfig: {
        ...emptyHttpCollection(),
        documentation: 'Manual documentation',
      },
    },
  ]) {
    db.folders.updateFolder(folderId, metadata)
    expect(() => manager.undo(result.proposal.id, 0)).toThrow('STALE_PROPOSAL')
    expect(readFolder()).toMatchObject(metadata)
    db.folders.updateFolder(folderId, {
      name: original.name,
      icon: original.icon,
      collectionConfig: httpCollectionSchema.parse(original.collectionConfig),
    })
  }
  const child = db.folders.createFolder({
    name: 'Manual child',
    parentId: folderId,
  }).id
  expect(() => manager.undo(result.proposal.id, 0)).toThrow('FOLDER_NOT_EMPTY')
  expect(readFolder()).toBeDefined()
  db.folders.deleteFolder(child)
  const request = db.requests.createRequest({
    name: 'Manual request',
    folderId,
  }).id
  expect(() => manager.undo(result.proposal.id, 0)).toThrow('FOLDER_NOT_EMPTY')
  expect(db.requests.getRequestById(request)).toMatchObject({
    folderId,
    isDeleted: 0,
  })
  db.requests.updateRequest(request, { folderId: null })
  resetHttpRuntimeCache()
  expect(readFolder()!.isOpen).toBe(1)
  expect(manager.undo(result.proposal.id, 0)).toBe(true)
  expect(readFolder()).toBeUndefined()
})

it('still requires the exact requested name for explicit HTTP updates', () => {
  const db = useHttpStorage().requests
  const trashedId = db.createRequest({ name: 'Socket' }).id
  db.updateRequest(trashedId, { isDeleted: 1 })
  const id = db.createRequest({ name: 'Other' }).id
  const manager = createWorkspaceManager()
  const proposal = manager.propose(
    plan([op('item', 'update', id, { name: 'Socket' })]),
  )
  expect(manager.apply(proposal.id, [0])).toMatchObject({
    applied: [],
    failed: 0,
  })
  expect(db.getRequestById(id)).toMatchObject({ name: 'Other', isDeleted: 0 })
  expect(db.getRequestById(trashedId)).toMatchObject({
    name: 'Socket',
    isDeleted: 1,
  })
})

it('duplicates complete WebSocket definitions and runtime from storage, with no favorite or secret leakage', () => {
  const db = useHttpStorage().requests
  const id = db.createRequest({
    name: 'Socket',
    protocol: 'websocket',
    method: 'POST',
    url: 'wss://example.test',
  }).id
  db.updateRequest(id, {
    bodyType: 'multipart',
    body: null,
    formData: [{ key: 'asset', value: '/user/chosen.dat', type: 'file' }],
    auth: { type: 'bearer', token: 'private-value' },
    headers: [{ key: 'X-Test', value: 'value' }],
    description: 'description',
    isFavorites: 1,
  })
  const runtime = {
    ...emptyHttpRuntime(),
    version: 2 as const,
    scripts: { preRequest: 'const x = 1', postResponse: '' },
    transport: { timeoutMs: 4321 },
    extractions: [{ name: 'id', source: 'json' as const, path: '/id' }],
  }
  db.updateRuntime(id, runtime, 'missing')
  const before = structuredClone(db.getRequestById(id))
  const manager = createWorkspaceManager()
  const result = manager.create(
    creationPlan({
      summary: 'Duplicate',
      items: [{ type: 'duplicate', space: 'http', sourceId: id }],
    }),
  )
  expect(result.failed).toBeUndefined()
  expect(result.items[0]!.type).toBe('http_request')
  expect(db.getRequestById(result.items[0]!.id)).toMatchObject({
    protocol: 'websocket',
    method: 'POST',
    url: 'wss://example.test',
    bodyType: 'multipart',
    body: null,
    formData: before!.formData,
    auth: before!.auth,
    headers: before!.headers,
    description: 'description',
    runtime,
    isFavorites: 0,
  })
  expect(db.getRequestById(id)).toEqual(before)
  expect(JSON.stringify(result.proposal)).not.toContain('private-value')
  expect(
    workspaceInventory({ space: 'http' }).items.find(item => item.id === id),
  ).toMatchObject({ protocol: 'websocket' })
  manager.undo(result.proposal.id, 0)
  expect(db.getRequestById(result.items[0]!.id)!.isDeleted).toBe(1)
})
it('patches runtime and collection config with CAS and exact inheritance Undo', () => {
  const db = useHttpStorage()
  const parent = db.folders.createFolder({ name: 'Parent' }).id
  const child = db.folders.createFolder({ name: 'Child', parentId: parent }).id
  db.folders.updateFolder(parent, {
    collectionConfig: {
      ...emptyHttpCollection(),
      headers: [{ key: 'X-Parent', value: 'parent' }],
      auth: { type: 'bearer', token: 'secret-auth' },
    },
  })
  const original = resolveHttpFolderConfig(db.folders.getFolders(), child)
  const changed = apply(
    op('folder', 'update', child, {
      collectionConfig: {
        headers: [{ key: 'X-Child', value: 'child' }],
        auth: { type: 'inherit' },
      },
    }),
  )
  expect(readHttpState({ kind: 'collection', id: child })).not.toEqual(
    expect.objectContaining({ token: 'secret-auth' }),
  )
  expect(JSON.stringify(changed.proposal)).not.toContain('secret-auth')
  expect(
    resolveHttpFolderConfig(db.folders.getFolders(), child)!.headers,
  ).toHaveLength(2)
  changed.manager.undo(changed.proposal.id, 0)
  expect(
    db.folders.getFolders().find(folder => folder.id === child)!
      .collectionConfig,
  ).toBeUndefined()
  expect(resolveHttpFolderConfig(db.folders.getFolders(), child)).toEqual(
    original,
  )
  const id = db.requests.createRequest({ name: 'Request' }).id
  const runtime = {
    ...emptyHttpRuntime(),
    version: 2 as const,
    scripts: { preRequest: 'pre', postResponse: 'post' },
    transport: { timeoutMs: 1000, followRedirects: false },
    extractions: [{ name: 'id', source: 'json' as const, path: '/id' }],
  }
  db.requests.updateRuntime(id, runtime, 'missing')
  const edit = apply(
    op('item', 'update', id, { runtime: { transport: { timeoutMs: 2000 } } }),
  )
  expect(db.requests.getRequestById(id)!.runtime).toEqual({
    ...runtime,
    transport: { ...runtime.transport, timeoutMs: 2000 },
  })
  edit.manager.undo(edit.proposal.id, 0)
  expect(db.requests.getRequestById(id)!.runtime).toEqual(runtime)
  const pending = edit.manager.propose(
    plan([
      op('item', 'update', id, {
        runtime: {
          assertions: [
            { name: 'OK', source: 'status', operator: 'eq', expected: 200 },
          ],
        },
      }),
    ]),
  )
  const current = db.requests.getRequestById(id)!
  db.requests.updateRuntime(
    id,
    { ...runtime, transport: { timeoutMs: 3000 } },
    current.runtimeRevision!,
  )
  expect(() => edit.manager.apply(pending.id, [0])).toThrow('STALE_PROPOSAL')
  expect(() =>
    edit.manager.propose(
      plan([
        op('item', 'update', id, {
          runtime: { assertions: [] },
          scripts: { preRequest: '', postResponse: '' },
        }),
      ]),
    ),
  ).toThrow('CONFLICTING_RUNTIME')
})
it('requires user-supplied new file references but preserves existing ones without reading files', () => {
  const manager = createWorkspaceManager()
  const input = creationPlan({
    summary: 'File definition',
    items: [
      {
        type: 'http_request',
        name: 'Binary',
        method: 'POST',
        url: 'https://example.test',
        bodyType: 'binary',
        body: '/explicit/file.bin',
      },
    ],
  })
  expect(() => manager.create(input)).toThrow('FILE_REFERENCE_NOT_REQUESTED')
  const created = manager.create(input, [
    'Use /explicit/file.bin as the binary body',
  ])
  expect(created.failed).toBeUndefined()
  expect(
    useHttpStorage().requests.getRequestById(created.items[0]!.id)!.body,
  ).toBe('/explicit/file.bin')
  expect(() =>
    manager.propose(
      plan([
        op('item', 'update', created.items[0]!.id, {
          body: '/guessed/file.bin',
        }),
      ]),
    ),
  ).toThrow('FILE_REFERENCE_NOT_REQUESTED')
})
it('supports HTTP trash/restore collisions, permanent deletion and descendant folder deletion', () => {
  const db = useHttpStorage()
  const one = db.folders.createFolder({ name: 'One' }).id
  const two = db.folders.createFolder({ name: 'Two' }).id
  const first = db.requests.createRequest({ name: 'Same', folderId: one }).id
  const second = db.requests.createRequest({ name: 'Same', folderId: two }).id
  apply(op('item', 'trash', first))
  const trashed = apply(op('item', 'trash', second))
  trashed.manager.undo(trashed.proposal.id, 0)
  expect(db.requests.getRequestById(second)).toMatchObject({
    name: 'Same',
    folderId: two,
    isDeleted: 0,
  })
  const restore = apply(op('item', 'restore', first))
  expect(restore.result.items[0]!.type).toBe('http_request')
  expect(db.requests.getRequestById(first)).toMatchObject({
    isDeleted: 0,
    folderId: null,
  })
  restore.manager.undo(restore.proposal.id, 0)
  apply(op('item', 'permanentDelete', first))
  expect(db.requests.getRequestById(first)).toBeNull()
  apply(op('folder', 'delete', two))
  expect(db.requests.getRequestById(second)).toMatchObject({
    folderId: null,
    isDeleted: 1,
  })
})
it('keeps environments unchanged until review, preserves protected keys, and applies patch/unset with stale protection', () => {
  const db = useHttpStorage().environments
  const id = db.createEnvironment({
    name: 'Original',
    variables: { baseUrl: 'https://old.test', keep: 'yes', remove: 'old' },
  }).id
  db.addSecretKey(id, 'TOKEN')
  db.addSecretKey(id, 'MISSING')
  const manager = createWorkspaceManager()
  const proposal = manager.propose(
    plan([
      op('environment', 'update', id, {
        variables: { baseUrl: 'https://new.test' },
        unset: ['remove'],
      }),
    ]),
  )
  expect(db.getEnvironments()[0]!.variables.baseUrl).toBe('https://old.test')
  expect(manager.apply(proposal.id, [0]).failed).toBeUndefined()
  expect(db.getEnvironments()[0]!).toMatchObject({
    variables: { baseUrl: 'https://new.test', keep: 'yes' },
    secretKeys: ['TOKEN', 'MISSING'],
  })
  expect(readHttpState({ kind: 'environments', id })).toMatchObject({
    items: [
      {
        protectedKeys: ['TOKEN', 'MISSING'],
        missingProtectedKeys: ['MISSING'],
        variables: { baseUrl: 'https://new.test', keep: 'yes' },
      },
    ],
  })
  expect(() =>
    manager.propose(
      plan([op('environment', 'update', id, { variables: { TOKEN: 'bad' } })]),
    ),
  ).toThrow('PROTECTED_VARIABLE')
  expect(() =>
    manager.propose(
      plan([
        op('environment', 'update', id, {
          variables: { baseUrl: '[REDACTED]' },
        }),
      ]),
    ),
  ).toThrow('INVALID_OPERATION')
  manager.undo(proposal.id, 0)
  expect(db.getEnvironments()[0]!.variables.remove).toBe('old')
  const pending = manager.propose(
    plan([op('environment', 'activate', undefined, { environmentId: id })]),
  )
  const other = db.createEnvironment({ name: 'Other' }).id
  db.setActiveEnvironment(other)
  expect(() => manager.apply(pending.id, [0])).toThrow('STALE_PROPOSAL')
  const created = manager.propose(
    plan([
      op('environment', 'create', undefined, {
        name: 'Local',
        variables: { baseUrl: 'http://localhost' },
        activate: true,
      }),
    ]),
  )
  expect(db.getEnvironments().some(env => env.name === 'Local')).toBe(false)
  expect(manager.apply(created.id, [0]).failed).toBeUndefined()
  expect(
    db.getEnvironments().find(env => env.id === db.getActiveEnvironmentId())!
      .name,
  ).toBe('Local')
  manager.undo(created.id, 0)
  expect(db.getActiveEnvironmentId()).toBe(other)
  const removed = apply(op('environment', 'delete', id))
  expect(removed.proposal.changes[0]!.irreversible).toBe(true)
  expect(secrets.remove).toHaveBeenCalled()
  expect(db.getEnvironments().some(env => env.id === id)).toBe(false)
})

it('removes one transport override and undoes first runtime additions exactly', () => {
  const db = useHttpStorage().requests
  const id = db.createRequest({ name: 'Runtime reset' }).id
  const original = db.getRequestById(id)!.runtime
  const script = apply(
    op('item', 'update', id, {
      runtime: { scripts: { preRequest: 'console.log(1)', postResponse: '' } },
    }),
  )
  expect(db.getRequestById(id)!.runtime!.version).toBe(2)
  script.manager.undo(script.proposal.id, 0)
  expect(db.getRequestById(id)!.runtime).toEqual(original)
  const transport = apply(
    op('item', 'update', id, {
      runtime: { transport: { timeoutMs: 1000, followRedirects: false } },
    }),
  )
  const before = structuredClone(db.getRequestById(id)!.runtime)
  const unset = apply(
    op('item', 'update', id, { runtime: { unsetTransport: ['timeoutMs'] } }),
  )
  expect(db.getRequestById(id)!.runtime!.transport).toEqual({
    followRedirects: false,
  })
  unset.manager.undo(unset.proposal.id, 0)
  expect(db.getRequestById(id)!.runtime).toEqual(before)
  // A separate first addition must undo to the original v1 with no transport key.
  const other = db.createRequest({ name: 'First transport' }).id
  const first = apply(
    op('item', 'update', other, {
      runtime: { transport: { timeoutMs: 1000 } },
    }),
  )
  first.manager.undo(first.proposal.id, 0)
  expect(db.getRequestById(other)!.runtime).toEqual(original)
  expect(transport.result.applied).toEqual([0])
})

it('resets only collection post-response order and preserves inherited auth on first config', () => {
  const db = useHttpStorage().folders
  const parent = db.createFolder({ name: 'Parent' }).id
  const child = db.createFolder({ name: 'Child', parentId: parent }).id
  db.updateFolder(parent, {
    collectionConfig: {
      ...emptyHttpCollection(),
      postResponseOrder: 'parent-first',
      auth: { type: 'bearer', token: 'saved-secret' },
    },
  })
  apply(
    op('folder', 'update', child, {
      collectionConfig: {
        headers: [{ key: 'X-Own', value: 'kept' }],
        postResponseOrder: 'child-first',
      },
    }),
  )
  expect(resolveHttpFolderConfig(db.getFolders(), child)!.auth).toMatchObject({
    type: 'bearer',
    token: 'saved-secret',
  })
  const reset = apply(
    op('folder', 'update', child, {
      collectionConfig: { postResponseOrder: null },
    }),
  )
  expect(
    resolveHttpFolderConfig(db.getFolders(), child)!.postResponseOrder,
  ).toBe('parent-first')
  expect(
    db.getFolders().find(folder => folder.id === child)!.collectionConfig,
  ).toMatchObject({ headers: [{ key: 'X-Own', value: 'kept' }] })
  reset.manager.undo(reset.proposal.id, 0)
  expect(
    resolveHttpFolderConfig(db.getFolders(), child)!.postResponseOrder,
  ).toBe('child-first')
})
it('stores GraphQL editor drafts and structured form bodies without changing their format', () => {
  const manager = createWorkspaceManager()
  const draft = JSON.stringify({
    query: 'query { user { id } }',
    variables: '{}',
    operationName: '',
  })
  const result = manager.create(
    creationPlan({
      summary: 'Bodies',
      items: [
        {
          type: 'http_request',
          name: 'GraphQL',
          method: 'POST',
          url: 'https://example.test/graphql',
          bodyType: 'graphql',
          body: draft,
        },
        {
          type: 'http_request',
          name: 'Form',
          method: 'POST',
          url: 'https://example.test/form',
          bodyType: 'form-urlencoded',
          body: null,
          formData: [{ key: 'q', type: 'text', value: 'value' }],
        },
      ],
    }),
  )
  expect(result.failed).toBeUndefined()
  expect(
    useHttpStorage().requests.getRequestById(result.items[0]!.id)!.body,
  ).toBe(draft)
  expect(
    useHttpStorage().requests.getRequestById(result.items[1]!.id),
  ).toMatchObject({ body: null, formData: [{ key: 'q', value: 'value' }] })
  expect(() =>
    manager.propose(
      plan([
        op('item', 'update', result.items[0]!.id, {
          body: JSON.stringify({ query: '', variables: {}, operationName: '' }),
        }),
      ]),
    ),
  ).toThrow('GRAPHQL_DRAFT')
})

const transport = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('undici', () => ({ Agent: class {}, request: transport.request }))
vi.mock('../../http/cookies/store', () => ({
  getHttpCookieJar: () => ({ enabled: () => false }),
}))
it('keeps the real redacted execution snapshot with persistent history disabled', async () => {
  const { createHttpActionManager } = await import('../httpActions')
  const id = useHttpStorage().requests.createRequest({
    name: 'No history',
    method: 'GET',
    url: 'https://example.test/no-history',
  }).id
  useHttpStorage().requests.updateRequest(id, {
    auth: { type: 'bearer', token: 'private-token' },
  })
  transport.request.mockResolvedValueOnce({
    body: Readable.from(['fresh response private-token']),
    headers: { 'content-type': 'text/plain' },
    statusCode: 200,
  })
  const manager = createHttpActionManager(
    Object.assign(new EventEmitter(), { id: 991 }) as any,
  )
  const proposal = manager.propose({
    action: 'send',
    source: 'saved',
    requestId: id,
    summary: 'Send',
  })
  const result = await manager.apply(proposal.id)
  expect(result.view.state).toBe('done')
  expect(result.view.result).toMatchObject({
    responseContext: {
      requestId: id,
      source: 'saved',
      request: { method: 'GET', url: 'https://example.test/no-history' },
      response: { body: 'fresh response [REDACTED]' },
    },
  })
  expect(JSON.stringify(result.view)).not.toContain('private-token')
  expect(useHttpStorage().history.getEntries()).toEqual([])
  expect(transport.request).toHaveBeenCalledOnce()
})

it('retries partial request script Undo with the original runtime discriminator', () => {
  const db = useHttpStorage().requests
  const id = db.createRequest({ name: 'Request script Undo' }).id
  const original = structuredClone(db.getRequestById(id)!.runtime)
  const applied = apply(
    op('item', 'update', id, {
      runtime: { scripts: { preRequest: 'console.log(1)', postResponse: '' } },
    }),
  )
  const saved = db.getRequestById(id)!
  db.updateRuntime(
    id,
    {
      ...saved.runtime!,
      scripts: { preRequest: 'manual script', postResponse: '' },
    },
    saved.runtimeRevision!,
  )
  expect(applied.manager.undo(applied.proposal.id, 0, true)).toMatchObject({
    undone: false,
    conflicts: ['runtime.scripts'],
  })
  const current = db.getRequestById(id)!
  expect(current.runtime).toMatchObject({
    version: 2,
    scripts: { preRequest: 'manual script' },
  })
  db.updateRuntime(
    id,
    { ...current.runtime!, scripts: saved.runtime!.scripts },
    current.runtimeRevision!,
  )
  expect(applied.manager.undo(applied.proposal.id, 0, true)).toEqual({
    undone: true,
    conflicts: [],
  })
  expect(db.getRequestById(id)!.runtime).toEqual(original)
})

it('partially undoes collection changes while retaining manually edited first scripts and valid runtime version', () => {
  const db = useHttpStorage().folders
  const id = db.createFolder({ name: 'Scripts Undo' }).id
  db.updateFolder(id, { collectionConfig: emptyHttpCollection() })
  const applied = apply(
    op('folder', 'update', id, {
      collectionConfig: {
        documentation: 'AI documentation',
        runtime: {
          scripts: { preRequest: 'console.log(1)', postResponse: '' },
        },
      },
    }),
  )
  const saved = httpCollectionSchema.parse(
    db.getFolders().find(folder => folder.id === id)!.collectionConfig,
  )
  db.updateFolder(id, {
    collectionConfig: {
      ...saved,
      runtime: {
        ...saved.runtime,
        scripts: { preRequest: 'manual script', postResponse: '' },
      },
    },
  })
  const result = applied.manager.undo(applied.proposal.id, 0, true)
  expect(result).toMatchObject({
    undone: false,
    conflicts: ['collectionConfig.runtime.scripts'],
  })
  const current = httpCollectionSchema.parse(
    db.getFolders().find(folder => folder.id === id)!.collectionConfig,
  )
  expect(current.documentation).toBe('')
  expect(current.runtime).toMatchObject({
    version: 2,
    scripts: { preRequest: 'manual script', postResponse: '' },
  })
  db.updateFolder(id, {
    collectionConfig: {
      ...current,
      runtime: { ...current.runtime, scripts: saved.runtime.scripts },
    },
  })
  expect(applied.manager.undo(applied.proposal.id, 0, true)).toEqual({
    undone: true,
    conflicts: [],
  })
  const restored = httpCollectionSchema.parse(
    db.getFolders().find(folder => folder.id === id)!.collectionConfig,
  )
  expect(restored.runtime).toEqual(emptyHttpCollection().runtime)
})
