import { describe, expect, it } from 'vitest'
import { creationPlan, workspaceCreationSchema } from '../workspaceCreation'

describe('typed workspace creation', () => {
  it('keeps mixed-space batches and collection dependencies without exposing internal actions', () => {
    const result = creationPlan({
      summary: 'Create',
      items: [
        { type: 'http_collection', name: 'API' },
        {
          type: 'http_request',
          name: 'Users',
          method: 'GET',
          url: 'https://example.test/users',
          folderOperation: 0,
        },
        { type: 'note', name: 'Notes', content: 'hello' },
        {
          type: 'snippet',
          name: 'Sum',
          content: 'a + b',
          language: 'javascript',
        },
      ],
    })
    expect(
      result.operations.map(op => [op.space, op.kind, op.action]),
    ).toEqual([
      ['http', 'folder', 'create'],
      ['http', 'item', 'create'],
      ['notes', 'item', 'create'],
      ['code', 'item', 'create'],
    ])
    expect(result.operations[0]!.fields).toEqual({
      name: 'API',
      collection: true,
    })
    expect(result.operations[1]!.fields).toMatchObject({ folderOperation: 0 })
  })
  it.each([
    { type: 'note', name: 'Note', content: 'x', language: 'ru' },
    { type: 'note', name: 'Note', content: 'x', id: 1 },
    { type: 'snippet', name: 'Code', content: 'x' },
    { type: 'http_request', name: 'HTTP', content: 'x' },
    {
      type: 'http_request',
      name: 'HTTP',
      method: 'GET',
      url: 'https://example.test',
      query: ['limit=10'],
    },
    { type: 'http_collection', name: 'API', folderId: 1 },
    { type: 'folder', space: 'notes', name: 'Folder', tags: ['extra'] },
  ])('rejects incompatible or incomplete fields: %j', (item) => {
    expect(
      workspaceCreationSchema.safeParse({ summary: 'Create', items: [item] })
        .success,
    ).toBe(false)
  })
  it('does not add metadata or translate explicit names', () => {
    const result = creationPlan({
      summary: 'Create',
      items: [{ type: 'note', name: 'QA покупки', content: 'молоко' }],
    })
    expect(result.operations[0]!.fields).toEqual({
      name: 'QA покупки',
      content: 'молоко',
    })
  })
})

it('preserves explicitly requested favorite and task fields', () => {
  const plan = creationPlan({
    summary: 'Create task',
    items: [
      {
        type: 'note',
        name: 'Release',
        content: '',
        isFavorites: 1,
        properties: { type: 'task', status: 'todo', due: '2026-09-22' },
      },
    ],
  })
  expect(plan.operations[0]!.fields).toMatchObject({
    isFavorites: 1,
    properties: { type: 'task', status: 'todo', due: '2026-09-22' },
  })
})

it('preserves complete literal labels when a word also specifies a property or content', () => {
  const result = creationPlan({
    summary: 'Create',
    items: [
      {
        type: 'note',
        name: 'QA10A избранное',
        content: 'привет',
        isFavorites: 1,
      },
      {
        type: 'snippet',
        name: 'QA10B сумма',
        content: 'function sum(a, b) { return a + b }',
        language: 'JavaScript',
      },
      { type: 'http_collection', name: 'API коллекция' },
    ],
  })
  expect(result.operations.map(operation => operation.fields.name)).toEqual([
    'QA10A избранное',
    'QA10B сумма',
    'API коллекция',
  ])
  expect(result.operations[0]!.fields).toMatchObject({ isFavorites: 1 })
  expect(result.operations[1]!.fields).toMatchObject({
    language: 'javascript',
  })
})
