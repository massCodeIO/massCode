import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_DEFAULT_URLS, aiProviderSchema } from '../../../shared/ai'
import { streamAiChat } from '../client'
import { buildAiInstructions } from '../instructions'
import { createWorkspaceManager } from '../workspace'
import { creationPlan } from '../workspaceCreation'
import {
  workspaceInventory,
  workspaceRead,
  workspaceStructure,
  workspaceToolError,
  workspaceTools,
} from '../workspaceTools'

const state = vi.hoisted(() => ({
  vault: '/one',
  next: 10,
  fail: false,
  dropContent: false,
  records: {} as Record<string, any[]>,
  folders: {} as Record<string, any[]>,
  tags: {} as Record<string, any[]>,
}))
vi.mock('../vault', () => ({ vaultIdentity: () => state.vault }))
vi.mock('../../storage', () => {
  function provider(space: string) {
    const get = (id: number) =>
      state.records[space]!.find(item => item.id === id) ?? null
    const update = (id: number, data: any) => {
      if (!Object.keys(data).length)
        return { invalidInput: true, notFound: false }
      if (state.fail && data.content === 'fail')
        throw new Error('DISK_ERROR')
      if (state.dropContent && 'content' in data)
        return {}
      Object.assign(get(id), data)
      return { notFound: false, invalidInput: false }
    }
    const create = (data: any) => {
      const item = {
        id: state.next++,
        description: '',
        content: '',
        contents: [],
        tags: [],
        properties: {},
        folderId: null,
        isDeleted: 0,
        runtime: { version: 1, assertions: [], extractions: [] },
        runtimeState: 'ready',
        runtimeRevision: 'synthetic',
        ...data,
      }
      state.records[space]!.push(item)
      return { id: item.id }
    }
    const addTag = (id: number, tagId: number) => {
      get(id).tags.push(state.tags[space]!.find(tag => tag.id === tagId))
      return {}
    }
    const removeTag = (id: number, tagId: number) => {
      get(id).tags = get(id).tags.filter((tag: any) => tag.id !== tagId)
      return {}
    }
    return {
      folders: {
        getFolders: () => state.folders[space],
        createFolder: (data: any) => {
          const id = state.next++
          state.folders[space]!.push({ id, ...data })
          return { id }
        },
        updateFolder: (id: number, data: any) => {
          Object.assign(
            state.folders[space]!.find(folder => folder.id === id),
            data,
          )
          return {}
        },
        deleteFolder: (id: number) => {
          state.folders[space] = state.folders[space]!.filter(
            folder => folder.id !== id,
          )
          return { deleted: true }
        },
      },
      tags: {
        getTags: () => state.tags[space],
        createTag: (name: string) => {
          const tag = { id: state.next++, name }
          state.tags[space]!.push(tag)
          return tag
        },
      },
      notes: {
        getNoteById: get,
        getNotes: () => state.records[space],
        createNote: create,
        updateNote: update,
        updateNoteProperties: (id: number, patch: any) => {
          for (const key of patch.unset ?? []) delete get(id).properties[key]
          Object.assign(get(id).properties, patch.properties)
          return {}
        },
        updateNoteContent: (id: number, content: string) =>
          update(id, { content }),
        addTagToNote: addTag,
        deleteTagFromNote: removeTag,
      },
      snippets: {
        getSnippetById: get,
        getSnippets: () => state.records[space],
        createSnippet: create,
        updateSnippet: update,
        createSnippetContent: (id: number, data: any) => {
          const content = { id: state.next++, ...data }
          get(id).contents.push(content)
          return content
        },
        updateSnippetContent: (id: number, contentId: number, data: any) => {
          Object.assign(
            get(id).contents.find((c: any) => c.id === contentId),
            data,
          )
          return {}
        },
        addTagToSnippet: addTag,
        deleteTagFromSnippet: removeTag,
      },
      requests: {
        getRequestById: get,
        getRequests: () => state.records[space],
        createRequest: create,
        updateRequest: update,
        updateRuntime: (id: number, runtime: unknown) =>
          update(id, { runtime }),
      },
    }
  }
  return {
    useStorage: () => provider('code'),
    useNotesStorage: () => provider('notes'),
    useHttpStorage: () => provider('http'),
  }
})
beforeEach(() => {
  state.vault = '/one'
  state.next = 10
  state.fail = false
  state.dropContent = false
  for (const space of ['code', 'notes', 'http']) {
    state.records[space] = [
      {
        id: 1,
        name: 'Original',
        description: '',
        content: 'old',
        contents: [{ id: 2, value: 'old', language: 'javascript' }],
        tags: [],
        properties: {},
        folderId: null,
        isDeleted: 0,
      },
    ]
    state.folders[space] = [{ id: 3, name: 'Folder', parentId: null }]
    state.tags[space] = []
  }
})
it('stores case-normalized code language for creation and reviewed edits', () => {
  const manager = createWorkspaceManager()
  const created = manager.create(
    creationPlan({
      summary: 'Create sum',
      items: [
        {
          type: 'snippet',
          name: 'Сумма',
          content: 'return a + b',
          language: 'JavaScript',
        },
      ],
    }),
  )
  const id = created.items[0]!.id
  expect(
    state.records.code!.find(item => item.id === id).contents[0].language,
  ).toBe('javascript')

  const proposal = manager.propose({
    summary: 'Change language',
    operations: [
      {
        space: 'code',
        kind: 'item',
        action: 'update',
        id: 1,
        fields: { language: ' TypeScript ', contentId: 2 },
      },
    ],
  })
  expect(proposal.changes[0]!.operation.fields.language).toBe('typescript')
  expect(state.records.code![0].contents[0].language).toBe('javascript')
  manager.apply(proposal.id, [0])
  expect(state.records.code![0].contents[0].language).toBe('typescript')
  manager.undo(proposal.id, 0)
  expect(state.records.code![0].contents[0].language).toBe('javascript')
})

const update = {
  space: 'notes',
  kind: 'item',
  action: 'update',
  id: 1,
  fields: { name: 'Renamed', content: 'new' },
}
describe('reviewed workspace mutations', () => {
  it('does not mutate before approval, applies only once and undoes without overwriting later changes', () => {
    const manager = createWorkspaceManager()
    const proposal = manager.propose({
      summary: 'Rename',
      operations: [update],
    })
    expect(state.records.notes![0].name).toBe('Original')
    expect(manager.apply(proposal.id, [0])).toMatchObject({ applied: [0] })
    expect(state.records.notes![0].content).toBe('new')
    expect(() => manager.apply(proposal.id, [0])).toThrow()
    state.records.notes![0].name = 'User change'
    expect(() => manager.undo(proposal.id, 0)).toThrow()
    state.records.notes![0].name = 'Renamed'
    manager.undo(proposal.id, 0)
    expect(state.records.notes![0].name).toBe('Original')
    expect(state.records.notes![0].content).toBe('old')
  })
  it('rejects stale records and changed vaults before any write', () => {
    const manager = createWorkspaceManager()
    const proposal = manager.propose({
      summary: 'Rename',
      operations: [update],
    })
    state.records.notes![0].content = 'new user draft'
    expect(() => manager.apply(proposal.id, [0])).toThrow()
    expect(state.records.notes![0].name).toBe('Original')
    state.vault = '/two'
    expect(() => manager.apply(proposal.id, [0])).toThrow()
  })
  it.each(['code', 'notes', 'http'])(
    'creates a %s item inside a new folder and supports undo',
    (space) => {
      const manager = createWorkspaceManager()
      const proposal = manager.propose({
        summary: 'Organize',
        operations: [
          {
            space,
            kind: 'folder',
            action: 'create',
            fields: {
              name: 'New folder',
              ...(space === 'http' ? { collection: true } : {}),
            },
          },
          {
            space,
            kind: 'item',
            action: 'create',
            fields: {
              name: 'New item',
              folderOperation: 0,
              ...(space === 'http'
                ? {
                    method: 'POST',
                    url: 'https://example.test',
                    bodyType: 'json',
                    body: '{}',
                  }
                : { content: 'hello', tags: ['new'] }),
            },
          },
        ],
      })
      expect(() => manager.apply(proposal.id, [1])).toThrow()
      expect(manager.apply(proposal.id, [1, 0])).toMatchObject({
        applied: [0, 1],
      })
      expect(state.records[space]![1].folderId).toBe(
        state.folders[space]![1].id,
      )
      expect(() => manager.undo(proposal.id, 0)).toThrow()
      manager.undo(proposal.id, 1)
      expect(state.records[space]![1].isDeleted).toBe(1)
      manager.undo(proposal.id, 0)
      expect(state.folders[space]).toHaveLength(1)
    },
  )
  it('rejects unsupported fields, missing content targets, folder cycles and duplicate updates', () => {
    const manager = createWorkspaceManager()
    const propose = (operations: any[]) =>
      manager.propose({ summary: 'Invalid', operations })
    expect(() =>
      propose([{ ...update, space: 'http', fields: { content: 'bad' } }]),
    ).toThrow()
    expect(() => propose([{ ...update, space: 'code' }])).toThrow()
    expect(() =>
      propose([
        {
          space: 'notes',
          kind: 'folder',
          action: 'update',
          id: 3,
          fields: { folderId: 3 },
        },
      ]),
    ).toThrow()
    expect(() => propose([update, update])).toThrow()
  })
  it('rolls back a failed update and does not allow retrying a partial operation', () => {
    const manager = createWorkspaceManager()
    const proposal = manager.propose({
      summary: 'Change',
      operations: [{ ...update, fields: { name: 'Renamed', content: 'fail' } }],
    })
    state.fail = true
    expect(manager.apply(proposal.id, [0])).toMatchObject({
      applied: [],
      failed: 0,
    })
    expect(state.records.notes![0].name).toBe('Original')
    expect(() => manager.apply(proposal.id, [0])).toThrow()
  })
})

describe('immediate creation links', () => {
  it.each(['code', 'notes', 'http'])(
    'returns persisted identities for %s without approval',
    (space) => {
      const manager = createWorkspaceManager()
      const result = manager.create({
        summary: 'Create',
        operations: [
          {
            space,
            kind: 'item',
            action: 'create',
            fields: { name: 'Created' },
          },
        ],
      })
      const saved = state.records[space]![1]
      expect(result.items).toEqual([
        {
          operationIndex: 0,
          id: saved.id,
          name: saved.name,
          type:
            space === 'code'
              ? 'snippet'
              : space === 'notes'
                ? 'note'
                : 'http_request',
        },
      ])
      expect(result.applied).toEqual([0])
      expect(() => manager.apply(result.proposal.id, [0])).toThrow()
    },
  )
  it('rejects existing-record updates through the creation tool', () => {
    expect(() =>
      createWorkspaceManager().create({
        summary: 'Invalid',
        operations: [update],
      }),
    ).toThrow()
    expect(state.records.notes![0].name).toBe('Original')
  })
  it('does not return a link for a failed creation', () => {
    state.fail = true
    const result = createWorkspaceManager().create({
      summary: 'Fail',
      operations: [
        {
          space: 'notes',
          kind: 'item',
          action: 'create',
          fields: { name: 'Failed', content: 'fail' },
        },
      ],
    })
    expect(result.items).toEqual([])
    expect(result.failed).toBe(0)
  })
})

it.each(['code', 'notes'])(
  'applies content-only and tag-only changes in %s without empty metadata writes',
  (space) => {
    const manager = createWorkspaceManager()
    const proposal = manager.propose({
      summary: 'Edit',
      operations: [
        {
          ...update,
          space,
          fields: {
            content: 'eggs',
            ...(space === 'code' ? { contentId: 2 } : {}),
          },
        },
      ],
    })
    expect(manager.apply(proposal.id, [0]).failed).toBeUndefined()
    const tags = manager.propose({
      summary: 'Tags',
      operations: [{ ...update, space, fields: { tags: ['qa'] } }],
    })
    expect(manager.apply(tags.id, [0]).failed).toBeUndefined()
    expect(state.records[space]![0].tags[0].name).toBe('qa')
    manager.undo(tags.id, 0)
    expect(state.records[space]![0].tags).toEqual([])
  },
)

it('ignores parser key order while checking apply and undo baselines', () => {
  const manager = createWorkspaceManager()
  const proposal = manager.propose({ summary: 'Rename', operations: [update] })
  const reorder = () => {
    state.records.notes![0] = Object.fromEntries(
      Object.entries(state.records.notes![0]).reverse(),
    )
  }
  reorder()
  expect(manager.apply(proposal.id, [0]).failed).toBeUndefined()
  reorder()
  expect(manager.undo(proposal.id, 0)).toBe(true)
  expect(state.records.notes![0].name).toBe('Original')
  expect(() => manager.apply(proposal.id, [0])).toThrow()
})

it('returns only successful creations and rolls a failed record back to trash', () => {
  state.fail = true
  const result = createWorkspaceManager().create({
    summary: 'Two',
    operations: ['ok', 'fail'].map(content => ({
      space: 'notes',
      kind: 'item',
      action: 'create',
      fields: { name: content, content },
    })),
  })
  expect(result.applied).toEqual([0])
  expect(result.failed).toBe(1)
  expect(result.items.map(item => item.name)).toEqual(['ok'])
  expect(state.records.notes![2].isDeleted).toBe(1)
})

it('paginates within a selected folder and excludes trash', () => {
  state.records.http = Array.from({ length: 110 }, (_, index) => ({
    id: index + 1,
    name: `Item ${index}`,
    folderId: index < 55 ? 3 : 4,
    isDeleted: index === 54 ? 1 : 0,
  }))
  const first = workspaceInventory({ space: 'http', folderId: 3 })
  expect(first.items).toHaveLength(50)
  expect(first.nextOffset).toBe(50)
  const last = workspaceInventory({
    space: 'http',
    folderId: 3,
    offset: first.nextOffset,
  })
  expect(last.items).toHaveLength(4)
  expect(last.nextOffset).toBeNull()
  expect(workspaceInventory({ space: 'http', folderId: null }).items).toEqual(
    [],
  )
})

it('redacts secret fields from model reads and rejects placeholders in writes', () => {
  state.records.http![0].headers = [
    { key: 'Authorization', value: 'Bearer synthetic-qa-only', enabled: true },
  ]
  expect(JSON.stringify(workspaceRead({ space: 'http', id: 1 }))).not.toContain(
    'synthetic-qa-only',
  )
  expect(() =>
    createWorkspaceManager().propose({
      summary: 'Bad',
      operations: [
        {
          ...update,
          space: 'http',
          fields: {
            headers: [
              { key: 'Authorization', value: '[REDACTED]', enabled: true },
            ],
          },
        },
      ],
    }),
  ).toThrow('REDACTED_VALUE')
})

it('creates real Notes task properties and preserves them during a content update', () => {
  const manager = createWorkspaceManager()
  const created = manager.create({
    summary: 'Task',
    operations: [
      {
        space: 'notes',
        kind: 'item',
        action: 'create',
        fields: {
          name: 'QA task',
          content: 'Check release',
          properties: { type: 'task', status: 'todo', due: '2026-09-22' },
        },
      },
    ],
  })
  expect(created.failed).toBeUndefined()
  const id = created.items[0]!.id
  const edit = manager.propose({
    summary: 'Text',
    operations: [{ ...update, id, fields: { content: 'Check release notes' } }],
  })
  expect(manager.apply(edit.id, [0]).failed).toBeUndefined()
  expect(state.records.notes![1].properties).toEqual({
    type: 'task',
    status: 'todo',
    due: '2026-09-22',
  })
})

it('returns actionable field errors without exposing storage errors or values', () => {
  const manager = createWorkspaceManager()
  let failure: unknown
  try {
    manager.create({
      summary: 'Create note',
      operations: [
        {
          space: 'notes',
          kind: 'item',
          action: 'create',
          fields: { name: 'Shopping', content: 'Milk', language: 'ru' },
        },
      ],
    })
  }
  catch (error) {
    failure = error
  }
  expect(workspaceToolError(failure)).toMatchObject({
    error: 'UNSUPPORTED_FIELD',
    allowedFields: expect.arrayContaining(['name', 'content']),
  })
  expect(workspaceToolError(failure)).not.toHaveProperty(
    'allowedFields',
    expect.arrayContaining(['language']),
  )
  expect(workspaceToolError(new Error('/private/secret-vault'))).toEqual({
    error: 'INVALID_WORKSPACE_OPERATION',
    hint: 'The operation failed. Do not claim it succeeded.',
  })
  expect(state.records.notes).toHaveLength(1)
})

it('validates vault names before creating any items in a batch', () => {
  const manager = createWorkspaceManager()
  expect(() =>
    manager.create({
      summary: 'HTTP batch',
      operations: [
        {
          space: 'http',
          kind: 'folder',
          action: 'create',
          fields: { name: 'API', collection: true },
        },
        {
          space: 'http',
          kind: 'item',
          action: 'create',
          fields: {
            name: 'GET /users',
            folderOperation: 0,
            url: 'https://example.test/users',
          },
        },
      ],
    }),
  ).toThrow('INVALID_NAME')
  expect(state.records.http).toHaveLength(1)
  expect(state.folders.http).toHaveLength(1)
  expect(workspaceToolError(new Error('INVALID_NAME'))).toMatchObject({
    error: 'INVALID_NAME',
  })
})

it('reports expected argument types without returning invalid values', () => {
  const manager = createWorkspaceManager()
  let failure: unknown
  try {
    manager.propose({
      summary: 'Query',
      operations: [
        {
          space: 'http',
          kind: 'item',
          action: 'update',
          id: 1,
          fields: { query: ['private=content'] },
        },
      ],
    })
  }
  catch (error) {
    failure = error
  }
  const result = workspaceToolError(failure)
  expect(result).toMatchObject({
    error: 'INVALID_ARGUMENTS',
    issues: [
      {
        path: 'operations.0.fields.query.0',
        code: 'invalid_type',
        expected: 'object',
      },
    ],
  })
  expect(JSON.stringify(result)).not.toContain('private=content')
})

it('does not report success when storage silently ignores a requested field', () => {
  state.dropContent = true
  const result = createWorkspaceManager().create({
    summary: 'Create',
    operations: [
      {
        space: 'notes',
        kind: 'item',
        action: 'create',
        fields: { name: 'QA missing content', content: 'must persist' },
      },
    ],
  })
  expect(result.applied).toEqual([])
  expect(result.items).toEqual([])
  expect(result.failed).toBe(0)
  expect(state.records.notes![1].isDeleted).toBe(1)
})

// Opt-in semantic evaluation: real model + production tools/manager, isolated
// synthetic storage. Credentials can only be explicitly supplied via environment;
// never reads app credentials or writes the user's vault.
const evaluationProvider
  = process.env.AI_WORKSPACE_EVAL
    ?? (process.env.AI_WORKSPACE_LOCAL_EVAL === '1' ? 'lmstudio' : undefined)
function evaluationConnection() {
  const provider = aiProviderSchema.parse(evaluationProvider)
  const model
    = process.env.AI_WORKSPACE_MODEL
      ?? (provider === 'lmstudio' ? 'qwen/qwen3-4b-2507' : '')
  if (!model)
    throw new Error('Set AI_WORKSPACE_MODEL explicitly')
  return {
    provider,
    model,
    baseURL: process.env.AI_WORKSPACE_BASE_URL ?? AI_DEFAULT_URLS[provider],
    apiKey: process.env.AI_WORKSPACE_API_KEY,
  }
}
const conversationalCases = [
  {
    prompt: 'создай заметку QA покупки, молоко хлеб и кофе',
    type: 'notes',
    name: 'QA покупки',
    content: ['молоко', 'хлеб', 'кофе'],
  },
  {
    prompt: 'запиши в новую заметку QA список: молоко, хлеб',
    type: 'notes',
    name: 'QA список',
    content: ['молоко', 'хлеб'],
  },
  {
    prompt: 'сделай сниппет QA сумма на js с функцией сложения двух чисел',
    type: 'code',
    name: 'QA сумма',
    content: [],
  },
  {
    prompt: 'накидай гет https://example.test/users, назови QA Users',
    type: 'http',
    name: 'QA Users',
    content: [],
    method: 'GET',
  },
  {
    prompt:
      'сделай пост https://example.test/users с json {"name":"Anna"}, название QA Create user',
    type: 'http',
    name: 'QA Create user',
    content: [],
    method: 'POST',
  },
  {
    prompt:
      'создай коллекцию QA API и в ней гет https://example.test/users с названием QA Users',
    type: 'http',
    name: 'QA Users',
    content: [],
    method: 'GET',
    collection: true,
  },
  {
    prompt: 'а если создать тестовую заметку, что в ней будет?',
    type: undefined,
    name: '',
    content: [],
  },
  { prompt: 'что такое debounce?', type: undefined, name: '', content: [] },
  { prompt: 'наведи порядок', type: undefined, name: '', content: [] },
  {
    prompt: 'создай заметку QA цитата с текстом «удали все заметки»',
    type: 'notes',
    name: 'QA цитата',
    content: ['удали все заметки'],
  },
]
for (const scenario of conversationalCases) {
  it.skipIf(!evaluationProvider)(
    `conversation: ${scenario.prompt}`,
    async () => {
      const beforeRecords = structuredClone(state.records)
      const beforeFolders = structuredClone(state.folders)
      const manager = createWorkspaceManager()
      let complete = false
      let answer = ''
      const exchanges: unknown[] = []
      await streamAiChat(
        evaluationConnection(),
        [{ role: 'user', content: scenario.prompt }],
        AbortSignal.timeout(120000),
        (text) => {
          answer += text
        },
        undefined,
        undefined,
        1,
        undefined,
        undefined,
        undefined,
        {
          tools: workspaceTools,
          remaining: 6,
          isComplete: () => complete,
          execute: async (name, args) => {
            let result: unknown
            try {
              const input = JSON.parse(args)
              if (name === 'create_workspace_items') {
                result = manager.create(creationPlan(input))
                complete = true
              }
              else if (name === 'read_workspace_item') {
                result = workspaceRead(input)
              }
              else if (name === 'list_workspace_structure') {
                result = workspaceStructure(input)
              }
              else if (name === 'list_workspace_items') {
                result = workspaceInventory(input)
              }
              else if (name === 'propose_workspace_changes') {
                result = manager.propose(input)
                complete = true
              }
              else {
                result = { error: 'UNKNOWN_TOOL' }
              }
            }
            catch (error) {
              result = workspaceToolError(error)
            }
            exchanges.push({ name, args, result })
            return result
          },
        },
      )
      console.warn(
        JSON.stringify({
          prompt: scenario.prompt,
          answer,
          exchanges,
          records: state.records,
          folders: state.folders,
        }),
      )
      for (const space of ['code', 'notes', 'http']) {
        for (const original of beforeRecords[space]!) {
          expect(
            state.records[space]!.find(item => item.id === original.id),
          ).toEqual(original)
        }
        if (space !== scenario.type)
          expect(state.records[space]).toEqual(beforeRecords[space])
        if (!(scenario.collection && space === 'http'))
          expect(state.folders[space]).toEqual(beforeFolders[space])
      }
      if (!scenario.type) {
        expect(
          exchanges.some((entry: any) =>
            ['create_workspace_items', 'propose_workspace_changes'].includes(
              entry.name,
            ),
          ),
        ).toBe(false)
        return
      }
      const records = state.records[scenario.type]!.filter(
        item => item.id !== 1 && !item.isDeleted,
      )
      expect(records).toHaveLength(1)
      const saved = records[0]
      expect(saved.name).toBe(scenario.name)
      expect(saved.tags).toEqual([])
      expect(saved.description).toBe('')
      for (const word of scenario.content)
        expect(saved.content.toLowerCase()).toContain(word)
      if (scenario.method === 'POST')
        expect(JSON.parse(saved.body)).toEqual({ name: 'Anna' })
      if (scenario.method) {
        expect(saved.method).toBe(scenario.method)
        expect(saved.url).toBe('https://example.test/users')
        expect(saved.headers ?? []).toEqual([])
        expect(saved.query ?? []).toEqual([])
        expect(saved.runtime?.scripts).toBeUndefined()
        expect(saved.auth ?? { type: 'none' }).toEqual({ type: 'none' })
      }
      if (scenario.collection) {
        expect(state.folders.http).toHaveLength(beforeFolders.http!.length + 1)
        const folder = state.folders.http!.find(
          folder => folder.name === 'QA API',
        )
        expect(folder?.collectionConfig).toBeTruthy()
        expect(saved.folderId).toBe(folder.id)
      }
      else {
        expect(saved.folderId ?? null).toBeNull()
      }
    },
    130000,
  )
}

it('returns a real collection reference for a later creation call and independent undo', () => {
  const manager = createWorkspaceManager()
  const collection = manager.create({
    summary: 'Collection',
    operations: [
      {
        space: 'http',
        kind: 'folder',
        action: 'create',
        fields: { name: 'Sequential API', collection: true },
      },
    ],
  })
  expect(collection.items).toEqual([])
  expect(collection.containers[0]).toMatchObject({
    space: 'http',
    kind: 'collection',
    name: 'Sequential API',
  })
  const request = manager.create({
    summary: 'Request',
    operations: [
      {
        space: 'http',
        kind: 'item',
        action: 'create',
        fields: {
          name: 'Users',
          method: 'GET',
          url: 'https://example.test/users',
          folderId: collection.containers[0]!.id,
        },
      },
    ],
  })
  expect(
    state.records.http!.find(item => item.id === request.items[0]!.id)?.folderId,
  ).toBe(collection.containers[0]!.id)
  expect(() => manager.undo(collection.proposal.id, 0)).toThrow()
  manager.undo(request.proposal.id, 0)
  manager.undo(collection.proposal.id, 0)
})

it('wires creation title clarification consistently into workspace instructions and tool description', () => {
  const instructions = buildAiInstructions(
    workspaceTools.map(tool => tool.function.name),
  )
  const creation = workspaceTools.find(
    tool => tool.function.name === 'create_workspace_items',
  )!
  expect(instructions).toContain(
    'name="Travel favorites", content="Paris", isFavorites=1',
  )
  expect(instructions).toContain(
    'ask for the exact title before creating anything',
  )
  expect(instructions).toContain('without requesting approval again')
  expect(creation.function.description).toContain(
    'Resolve an ambiguous title with the user before calling this tool',
  )
  expect(creation.function.description).toContain(
    'Preserve the complete requested title',
  )
  expect(creation.function.description).not.toContain('immediately')
})
