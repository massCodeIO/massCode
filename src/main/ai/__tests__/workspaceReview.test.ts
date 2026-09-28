import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { workspaceReviewSchema } from '../workspaceReview'

function plan(operation: unknown) {
  return {
    summary: 'Update',
    operations: [operation],
  }
}
describe('workspace review contract', () => {
  it('exposes Code folder defaults without leaking fields to other spaces', () => {
    const update = {
      space: 'code',
      kind: 'folder',
      action: 'update',
      id: 1,
      fields: { defaultLanguage: 'typescript' },
    }
    expect(workspaceReviewSchema.parse(plan(update)).operations[0]).toEqual(
      update,
    )
    for (const space of ['notes', 'http']) {
      expect(
        workspaceReviewSchema.safeParse(plan({ ...update, space })).success,
      ).toBe(false)
    }
    expect(
      workspaceReviewSchema.safeParse(
        plan({ ...update, fields: { collectionConfig: null } }),
      ).success,
    ).toBe(false)
  })
  it('exposes Notes tag create/rename and rejects unsupported tag operations', () => {
    const create = {
      space: 'notes',
      kind: 'tag',
      action: 'create',
      fields: { name: 'Topic' },
    }
    const update = { ...create, action: 'update', id: 1 }
    expect(workspaceReviewSchema.parse(plan(create)).operations[0]).toEqual(
      create,
    )
    expect(workspaceReviewSchema.parse(plan(update)).operations[0]).toEqual(
      update,
    )
    for (const operation of [
      { ...create, id: 1 },
      { ...update, id: undefined },
      { ...update, space: 'code' },
      { ...update, space: 'http' },
      { ...update, fields: { name: '' } },
      { ...update, fields: { name: 'Topic', tags: ['extra'] } },
    ]) {
      expect(workspaceReviewSchema.safeParse(plan(operation)).success).toBe(
        false,
      )
    }
  })
  it.each([
    [
      'code',
      {
        content: 'return a + b',
        contentId: 2,
        language: 'javascript',
        tags: ['util'],
      },
    ],
    ['notes', { content: 'milk', properties: { type: 'task' }, tags: ['buy'] }],
    [
      'http',
      {
        method: 'POST',
        url: 'https://example.test',
        bodyType: 'json',
        body: '{}',
      },
    ],
  ])(
    'accepts supported %s edits and requires their target',
    (space, fields) => {
      const operation = {
        space,
        kind: 'item',
        action: 'update',
        id: 1,
        fields,
      }
      expect(
        workspaceReviewSchema.parse(plan(operation)).operations[0],
      ).toEqual(operation)
      expect(
        workspaceReviewSchema.safeParse(plan({ ...operation, id: undefined }))
          .success,
      ).toBe(false)
    },
  )
  it.each([
    ['notes', { language: 'javascript' }],
    ['http', { tags: ['x'] }],
    ['code', { properties: {} }],
    ['notes', { method: 'GET' }],
    ['http', { content: 'hello' }],
    ['code', { body: '{}' }],
  ])('rejects incompatible fields for %s', (space, fields) => {
    expect(
      workspaceReviewSchema.safeParse(
        plan({ space, kind: 'item', action: 'update', id: 1, fields }),
      ).success,
    ).toBe(false)
  })
  it('supports folder/collection creation with dependent moves but not item creation or collection conversion', () => {
    const operations = [
      {
        space: 'http',
        kind: 'folder',
        action: 'create',
        fields: { name: 'API', collection: true },
      },
      {
        space: 'http',
        kind: 'item',
        action: 'update',
        id: 2,
        fields: { folderOperation: 0 },
      },
      {
        space: 'notes',
        kind: 'folder',
        action: 'update',
        id: 3,
        fields: { folderId: null },
      },
    ]
    expect(
      workspaceReviewSchema.parse({ summary: 'Organize', operations })
        .operations,
    ).toEqual(operations)
    for (const operation of [
      {
        space: 'notes',
        kind: 'item',
        action: 'create',
        fields: { name: 'Note' },
      },
      {
        space: 'notes',
        kind: 'folder',
        action: 'create',
        fields: { name: 'Folder', tags: ['x'] },
      },
      {
        space: 'http',
        kind: 'folder',
        action: 'update',
        id: 1,
        fields: { collection: true },
      },
      { space: 'notes', kind: 'folder', action: 'create', fields: {} },
    ]) {
      expect(workspaceReviewSchema.safeParse(plan(operation)).success).toBe(
        false,
      )
    }
    expect(() => z.toJSONSchema(workspaceReviewSchema)).not.toThrow()
  })
})
