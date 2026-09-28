import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useNotesStorage, useStorage } from '../../storage'
import { getNotesPaths } from '../../storage/providers/markdown/notes/runtime/constants'
import { ensureNotesStateFile } from '../../storage/providers/markdown/notes/runtime/state'
import { resetNotesRuntimeCache } from '../../storage/providers/markdown/notes/runtime/sync'
import { getPaths } from '../../storage/providers/markdown/runtime/paths'
import { ensureStateFile } from '../../storage/providers/markdown/runtime/state'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { createWorkspaceManager } from '../workspace'
import { creationPlan } from '../workspaceCreation'
import { workspaceReviewSchema } from '../workspaceReview'
import {
  readCurrentWorkspace,
  workspaceInventory,
  workspaceRead,
  workspaceToolError,
  workspaceTools,
} from '../workspaceTools'

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
  resetRuntimeCache()
  resetNotesRuntimeCache()
  ensureStateFile(getPaths(tempVaultPath))
  ensureNotesStateFile(getNotesPaths(tempVaultPath))
})
afterEach(() => {
  resetRuntimeCache()
  resetNotesRuntimeCache()
  fs.removeSync(tempVaultPath)
})
function operation(
  space: 'code' | 'notes',
  kind: 'item' | 'fragment' | 'folder' | 'tag',
  action: string,
  id: number,
  fields = {},
) {
  return { space, kind, action, id, fields }
}
function apply(op: ReturnType<typeof operation>, publicContract = false) {
  const manager = createWorkspaceManager()
  const input = { summary: 'Change', operations: [op] }
  const proposal = manager.propose(
    publicContract ? workspaceReviewSchema.parse(input) : input,
  )
  const result = manager.apply(proposal.id, [0])
  expect(result.failed).toBeUndefined()
  return { manager, proposal, result }
}
it('duplicates stored multi-fragment snippets and notes without changing the source', () => {
  const code = useStorage()
  const id = code.snippets.createSnippet({ name: 'Source' }).id
  code.snippets.createSnippetContent(id, {
    label: 'JS',
    value: 'a()',
    language: 'javascript',
  })
  code.snippets.createSnippetContent(id, {
    label: 'CSS',
    value: '.a {}',
    language: 'css',
  })
  const tag = code.tags.createTag('tag').id
  code.snippets.addTagToSnippet(id, tag)
  const before = structuredClone(code.snippets.getSnippetById(id))
  const manager = createWorkspaceManager()
  const result = manager.create(
    creationPlan({
      summary: 'Duplicate',
      items: [{ type: 'duplicate', space: 'code', sourceId: id }],
    }),
  )
  expect(result.failed).toBeUndefined()
  const copy = code.snippets.getSnippetById(result.items[0]!.id)!
  expect(result.proposal.changes[0]!.name).toBe(copy.name)
  expect(
    copy.contents.map(({ label, value, language }) => ({
      label,
      value,
      language,
    })),
  ).toEqual(
    before!.contents.map(({ label, value, language }) => ({
      label,
      value,
      language,
    })),
  )
  expect(copy.tags).toEqual(before!.tags)
  expect(code.snippets.getSnippetById(id)).toEqual(before)
  manager.undo(result.proposal.id, 0)
  expect(code.snippets.getSnippetById(copy.id)!.isDeleted).toBe(1)
  const notes = useNotesStorage()
  const note = notes.notes.createNote({
    name: 'Task',
    properties: { type: 'task', status: 'todo' },
  }).id
  notes.notes.updateNoteContent(note, 'body')
  notes.notes.updateNote(note, { description: 'description' })
  const duplicated = manager.create(
    creationPlan({
      summary: 'Duplicate',
      items: [{ type: 'duplicate', space: 'notes', sourceId: note }],
    }),
  )
  expect(duplicated.failed).toBeUndefined()
  expect(notes.notes.getNoteById(duplicated.items[0]!.id)).toMatchObject({
    content: 'body',
    description: 'description',
    properties: { type: 'task', status: 'todo' },
  })
})
it.each([null, ''])(
  'restores the exact %j description before undoing a duplicate',
  (description) => {
    const { snippets, folders } = useStorage()
    const source = snippets.createSnippet({ name: 'Source' }).id
    for (const label of ['Implementation', 'Usage']) {
      snippets.createSnippetContent(source, {
        label,
        value: `${label}()`,
        language: 'javascript',
      })
    }
    const original = structuredClone(snippets.getSnippetById(source))
    const destination = folders.createFolder({ name: 'Destination' }).id
    const manager = createWorkspaceManager()
    const created = manager.create(
      creationPlan({
        summary: 'Duplicate',
        items: [
          {
            type: 'duplicate',
            space: 'code',
            sourceId: source,
            folderId: destination,
          },
        ],
      }),
    )
    expect(created.failed).toBeUndefined()
    const id = created.items[0]!.id
    // Empty and absent descriptions are distinct persisted values.
    if (description === '')
      snippets.updateSnippet(id, { description })
    const copy = snippets.getSnippetById(id)!
    expect(copy.description).toBe(description)
    const changes = copy.contents.map((fragment, index) => {
      const change = manager.propose({
        summary: 'Edit',
        operations: [
          operation('code', 'item', 'update', id, {
            contentId: fragment.id,
            content: `changed${index}()`,
            ...(index === 0
              ? { description: 'AI description', tags: ['ai'], isFavorites: 1 }
              : {}),
          }),
        ],
      })
      expect(manager.apply(change.id, [0]).failed).toBeUndefined()
      return change
    })
    for (const change of changes.reverse())
      expect(manager.undo(change.id, 0)).toBe(true)
    resetRuntimeCache()
    expect(snippets.getSnippetById(id)!.description).toBe(description)
    expect(snippets.getSnippetById(source)).toEqual(original)
    if (description === null) {
      // Creation's full-record guard must still protect independent manual edits.
      snippets.updateSnippet(id, { description: '' })
      expect(() => manager.undo(created.proposal.id, 0)).toThrow(
        'STALE_PROPOSAL',
      )
      snippets.updateSnippet(id, { description: null })
      expect(manager.undo(created.proposal.id, 0)).toBe(true)
      expect(snippets.getSnippetById(id)!.isDeleted).toBe(1)
    }
  },
)

it('targets exact snippet and fragment IDs and preserves siblings through edit and Undo', () => {
  const db = useStorage().snippets
  const id = db.createSnippet({ name: 'Code' }).id
  const first = db.createSnippetContent(id, {
    label: 'One',
    value: 'one',
    language: 'javascript',
  }).id
  const second = db.createSnippetContent(id, {
    label: 'Two',
    value: 'two',
    language: 'css',
  }).id
  const { manager, proposal } = apply(
    operation('code', 'fragment', 'update', id, {
      contentId: second,
      label: 'Changed',
      content: 'new',
      language: 'html',
    }),
  )
  expect(db.getSnippetById(id)!.contents).toMatchObject([
    { id: first, value: 'one' },
    { id: second, label: 'Changed', value: 'new', language: 'html' },
  ])
  manager.undo(proposal.id, 0)
  expect(db.getSnippetById(id)!.contents[1]).toMatchObject({
    label: 'Two',
    value: 'two',
    language: 'css',
  })
  const created = apply(
    operation('code', 'fragment', 'create', id, {
      label: 'Third',
      content: 'third',
      language: 'text',
    }),
  )
  expect(db.getSnippetById(id)!.contents).toHaveLength(3)
  created.manager.undo(created.proposal.id, 0)
  expect(db.getSnippetById(id)!.contents).toHaveLength(2)
  const deleted = apply(
    operation('code', 'fragment', 'delete', id, { contentId: second }),
  )
  expect(deleted.proposal.changes[0]!.irreversible).toBe(true)
  expect(() => deleted.manager.undo(deleted.proposal.id, 0)).toThrow(
    'STALE_PROPOSAL',
  )
  expect(() =>
    apply(operation('code', 'fragment', 'delete', id, { contentId: first })),
  ).toThrow('LAST_FRAGMENT')
})
it.each(['code', 'notes'] as const)(
  'discovers Trash, restores only deleted %s items, and requires Trash for permanent deletion',
  (space) => {
    const manager = createWorkspaceManager()
    const made = manager.create(
      creationPlan({
        summary: 'Create',
        items: [
          space === 'code'
            ? {
                type: 'snippet',
                name: 'Record',
                content: 'body',
                language: 'text',
              }
            : { type: 'note', name: 'Record', content: 'body' },
        ],
      }),
    )
    const id = made.items[0]!.id
    const originalFolder = (
      space === 'code' ? useStorage() : useNotesStorage()
    ).folders.createFolder({ name: 'Original folder' }).id
    apply(operation(space, 'item', 'update', id, { folderId: originalFolder }))
    const beforeTrash = workspaceRead({ space, id })
    expect(beforeTrash.folder.id).toBe(originalFolder)
    expect(() => apply(operation(space, 'item', 'restore', id))).toThrow(
      'TARGET_UNAVAILABLE',
    )
    expect(() =>
      apply(operation(space, 'item', 'permanentDelete', id)),
    ).toThrow('TARGET_UNAVAILABLE')
    const trashed = apply(operation(space, 'item', 'trash', id))
    expect(trashed.result.items).toEqual([])
    expect(
      workspaceInventory({ space, status: 'deleted' }).items.map(
        item => item.id,
      ),
    ).toContain(id)
    expect(workspaceRead({ space, id })).toMatchObject({ isDeleted: 1 })
    expect(() =>
      apply(operation(space, 'item', 'update', id, { name: 'Edited' })),
    ).toThrow('TARGET_UNAVAILABLE')
    const restored = apply(operation(space, 'item', 'restore', id))
    expect(restored.result.items[0]!.id).toBe(id)
    const afterRestore = workspaceRead({ space, id })
    expect(afterRestore.isDeleted).toBe(0)
    expect(afterRestore.folder).toBeNull()
    restored.manager.undo(restored.proposal.id, 0)
    const removed = apply(operation(space, 'item', 'permanentDelete', id))
    expect(removed.result.items).toEqual([])
    expect(() => workspaceRead({ space, id })).toThrow('TARGET_UNAVAILABLE')
  },
)
it.each(['code', 'notes'] as const)(
  'captures %s folder/tag relations for stale checks and exact deletion consequences',
  (space) => {
    const db = space === 'code' ? useStorage() : useNotesStorage()
    const folder = db.folders.createFolder({ name: 'Parent' }).id
    const child = db.folders.createFolder({
      name: 'Child',
      parentId: folder,
    }).id
    const manager = createWorkspaceManager()
    const made = manager.create(
      creationPlan({
        summary: 'Create',
        items: [
          space === 'code'
            ? {
                type: 'snippet',
                name: 'Record',
                content: 'body',
                language: 'text',
                folderId: child,
                tags: ['tag'],
              }
            : {
                type: 'note',
                name: 'Record',
                content: 'body',
                folderId: child,
                tags: ['tag'],
              },
        ],
      }),
    )
    const id = made.items[0]!.id
    const tag = db.tags.getTags()[0]!.id
    const removedTag = apply(operation(space, 'tag', 'delete', tag))
    expect(removedTag.proposal.changes[0]!.before).toContain('Record')
    expect(workspaceRead({ space, id }).tags).toEqual([])
    const proposal = manager.propose({
      summary: 'Delete folder',
      operations: [operation(space, 'folder', 'delete', folder)],
    })
    apply(operation(space, 'item', 'update', id, { name: 'Changed' }))
    expect(() => manager.apply(proposal.id, [0])).toThrow('STALE_PROPOSAL')
    const removed = apply(operation(space, 'folder', 'delete', folder))
    expect(removed.proposal.changes[0]!.irreversible).toBe(true)
    expect(db.folders.getFolders()).toEqual([])
    expect(workspaceRead({ space, id })).toMatchObject({
      isDeleted: 1,
      folder: null,
    })
  },
)

it('cleans up a failed duplicate and preserves earlier batch receipts and Undo', () => {
  const snippets = useStorage().snippets
  const id = snippets.createSnippet({ name: 'Original' }).id
  snippets.createSnippetContent(id, {
    label: 'One',
    value: 'one',
    language: 'text',
  })
  snippets.createSnippetContent(id, {
    label: 'Two',
    value: 'two',
    language: 'text',
  })
  const original = structuredClone(snippets.getSnippetById(id))
  const create = snippets.createSnippetContent.bind(snippets)
  const spy = vi
    .spyOn(snippets, 'createSnippetContent')
    .mockImplementation((id, input) => {
      if (input.label === 'Two')
        throw new Error('DISK_ERROR')
      return create(id, input)
    })
  try {
    const manager = createWorkspaceManager()
    const result = manager.create(
      creationPlan({
        summary: 'Batch',
        items: [
          { type: 'note', name: 'Kept', content: 'kept' },
          { type: 'duplicate', space: 'code', sourceId: id },
          { type: 'note', name: 'Unattempted', content: '' },
        ],
      }),
    )
    expect(result.applied).toEqual([0])
    expect(result.failed).toBe(1)
    expect(
      snippets.getSnippets({ isDeleted: 0 }).map(record => record.id),
    ).toEqual([id])
    expect(snippets.getSnippets({ isDeleted: 1 })).toEqual([])
    expect(snippets.getSnippetById(id)).toEqual(original)
    expect(
      useNotesStorage()
        .notes.getNotes({})
        .map(record => record.name),
    ).toEqual(['Kept'])
    manager.undo(result.proposal.id, 0)
    expect(
      useNotesStorage().notes.getNoteById(result.items[0]!.id)!.isDeleted,
    ).toBe(1)
  }
  finally {
    spy.mockRestore()
  }
})

it('rejects stale tag relations and stale fragment Undo without changing other data', () => {
  const db = useStorage()
  const id = db.snippets.createSnippet({ name: 'Record' }).id
  const contentId = db.snippets.createSnippetContent(id, {
    label: 'One',
    value: 'one',
    language: 'text',
  }).id
  const tag = db.tags.createTag('tag').id
  const manager = createWorkspaceManager()
  const proposal = manager.propose({
    summary: 'Delete tag',
    operations: [operation('code', 'tag', 'delete', tag)],
  })
  db.snippets.addTagToSnippet(id, tag)
  expect(() => manager.apply(proposal.id, [0])).toThrow('STALE_PROPOSAL')
  expect(db.tags.getTags()).toHaveLength(1)
  const edit = apply(
    operation('code', 'fragment', 'update', id, { contentId, content: 'new' }),
  )
  db.snippets.updateSnippetContent(id, contentId, { value: 'user edit' })
  expect(() => edit.manager.undo(edit.proposal.id, 0)).toThrow(
    'STALE_PROPOSAL',
  )
  expect(db.snippets.getSnippetById(id)!.contents[0]!.value).toBe('user edit')
})

it('removes only the newly persisted fragment when storage throws before returning its ID', () => {
  const db = useStorage().snippets
  const id = db.createSnippet({ name: 'Snippet' }).id
  db.createSnippetContent(id, {
    label: 'Existing',
    value: 'original',
    language: 'text',
  })
  const before = structuredClone(db.getSnippetById(id)!.contents)
  const create = db.createSnippetContent.bind(db)
  const spy = vi
    .spyOn(db, 'createSnippetContent')
    .mockImplementation((id, fields) => {
      create(id, fields)
      throw new Error('AFTER_WRITE')
    })
  try {
    const manager = createWorkspaceManager()
    const proposal = manager.propose({
      summary: 'Add',
      operations: [
        operation('code', 'fragment', 'create', id, {
          label: 'New',
          content: 'new',
          language: 'text',
        }),
      ],
    })
    expect(manager.apply(proposal.id, [0])).toMatchObject({
      applied: [],
      failed: 0,
    })
    expect(db.getSnippetById(id)!.contents).toEqual(before)
  }
  finally {
    spy.mockRestore()
  }
})

it('undoes fragment batches independently of sibling edits and snippet timestamps', () => {
  const db = useStorage().snippets
  const id = db.createSnippet({ name: 'Snippet' }).id
  const one = db.createSnippetContent(id, {
    label: 'One',
    value: 'one',
    language: 'text',
  }).id
  const two = db.createSnippetContent(id, {
    label: 'Two',
    value: 'two',
    language: 'text',
  }).id
  const neighbor = db.createSnippetContent(id, {
    label: 'Neighbor',
    value: 'neighbor',
    language: 'text',
  }).id
  const manager = createWorkspaceManager()
  const proposal = manager.propose({
    summary: 'Edit two',
    operations: [
      operation('code', 'fragment', 'update', id, {
        contentId: one,
        content: 'ONE',
      }),
      operation('code', 'fragment', 'update', id, {
        contentId: two,
        content: 'TWO',
      }),
    ],
  })
  expect(manager.apply(proposal.id, [0, 1]).applied).toEqual([0, 1])
  db.updateSnippetContent(id, neighbor, { value: 'user edit' })
  manager.undo(proposal.id, 1)
  manager.undo(proposal.id, 0)
  expect(
    db.getSnippetById(id)!.contents.map(content => content.value),
  ).toEqual(['one', 'two', 'user edit'])
  const added = apply(
    operation('code', 'fragment', 'create', id, {
      label: 'Extra',
      content: 'extra',
      language: 'text',
    }),
  )
  db.updateSnippetContent(id, neighbor, { value: 'later edit' })
  added.manager.undo(added.proposal.id, 0)
  expect(
    db.getSnippetById(id)!.contents.map(content => content.value),
  ).toEqual(['one', 'two', 'later edit'])
})

it.each(['code', 'notes'] as const)(
  'restores the original %s name and folder after Trash collision renaming',
  (space) => {
    const folders
      = space === 'code' ? useStorage().folders : useNotesStorage().folders
    const firstFolder = folders.createFolder({ name: 'First' }).id
    const secondFolder = folders.createFolder({ name: 'Second' }).id
    const manager = createWorkspaceManager()
    const create = (folderId: number) =>
      manager.create(
        creationPlan({
          summary: 'Create',
          items: [
            space === 'code'
              ? {
                  type: 'snippet',
                  name: 'Same',
                  content: 'body',
                  language: 'text',
                  folderId,
                }
              : { type: 'note', name: 'Same', content: 'body', folderId },
          ],
        }),
      ).items[0]!.id
    const first = create(firstFolder)
    const second = create(secondFolder)
    apply(operation(space, 'item', 'trash', first))
    const trashed = apply(operation(space, 'item', 'trash', second))
    expect(workspaceRead({ space, id: second }).name).not.toBe('Same')
    trashed.manager.undo(trashed.proposal.id, 0)
    expect(workspaceRead({ space, id: second })).toMatchObject({
      name: 'Same',
      isDeleted: 0,
      folder: { id: secondFolder },
    })
  },
)

it('reviews Notes tag dictionary creation/rename and preserves relations on Undo', () => {
  const db = useNotesStorage()
  const manager = createWorkspaceManager()
  const proposal = manager.propose(
    workspaceReviewSchema.parse({
      summary: 'Create tag',
      operations: [
        {
          space: 'notes',
          kind: 'tag',
          action: 'create',
          fields: { name: 'Topic' },
        },
      ],
    }),
  )
  expect(db.tags.getTags()).toEqual([])
  manager.apply(proposal.id, [0])
  const tag = db.tags.getTags()[0]!
  const noteId = db.notes.createNote({ name: 'Note' }).id
  db.notes.addTagToNote(noteId, tag.id)
  expect(() => manager.undo(proposal.id, 0)).toThrow()
  const renamed = apply(
    operation('notes', 'tag', 'update', tag.id, { name: 'Subject' }),
    true,
  )
  expect(db.tags.getTags()[0]?.name).toBe('Subject')
  renamed.manager.undo(renamed.proposal.id, 0)
  expect(db.tags.getTags()[0]?.name).toBe('Topic')
  expect(db.notes.getNoteById(noteId)?.tags[0]?.id).toBe(tag.id)
})
it('updates Code folder language and filters task/favorite inventory without reading every content', () => {
  const code = useStorage()
  const id = code.folders.createFolder({ name: 'Scripts' }).id
  const before = code.folders
    .getFolders()
    .find(folder => folder.id === id)!.defaultLanguage
  const updated = apply(
    operation('code', 'folder', 'update', id, {
      defaultLanguage: 'typescript',
    }),
    true,
  )
  expect(
    code.folders.getFolders().find(folder => folder.id === id)?.defaultLanguage,
  ).toBe('typescript')
  updated.manager.undo(updated.proposal.id, 0)
  expect(
    code.folders.getFolders().find(folder => folder.id === id)?.defaultLanguage,
  ).toBe(before)
  const notes = useNotesStorage().notes
  const task = notes.createNote({ name: 'Task' }).id
  notes.updateNote(task, { isFavorites: 1 })
  notes.updateNoteProperties(task, {
    properties: { type: 'task', status: 'todo', due: '2026-09-23' },
    unset: [],
  })
  notes.createNote({ name: 'Other' })
  const result = workspaceInventory({
    space: 'notes',
    taskType: 'task',
    taskStatus: 'todo',
    isFavorites: true,
  })
  expect(result.items).toEqual([
    expect.objectContaining({
      id: task,
      properties: expect.objectContaining({ status: 'todo' }),
    }),
  ])
})

it('resolves only captured workspace IDs from list metadata without hydrating note content', () => {
  const db = useNotesStorage()
  const id = db.notes.createNote({ name: 'Selected' }).id
  db.notes.updateNoteContent(id, 'Private body is not selection metadata')
  const read = vi.spyOn(db.notes, 'getNoteById')
  const result = readCurrentWorkspace({
    space: 'notes',
    selectedIds: [id, 999],
  })
  if (!('items' in result))
    throw new Error('missing workspace context')
  expect(result.items).toEqual([
    expect.objectContaining({ id, name: 'Selected' }),
    { id: 999, available: false },
  ])
  expect(JSON.stringify(result)).not.toContain('Private body')
  expect(read).not.toHaveBeenCalled()
  read.mockRestore()
})

it('projects native fragment previews to changed fields without exposing the parent snapshot', () => {
  const db = useStorage().snippets
  const id = db.createSnippet({ name: 'Preview code' }).id
  const contentId = db.createSnippetContent(id, {
    label: 'Main',
    value: 'alpha',
    language: 'javascript',
  }).id
  const manager = createWorkspaceManager()
  const propose = (
    action: 'create' | 'update' | 'delete',
    fields: Record<string, unknown>,
  ) =>
    manager.propose(
      workspaceReviewSchema.parse({
        summary: 'Preview',
        operations: [operation('code', 'fragment', action, id, fields)],
      }),
    ).changes[0]!
  const update = propose('update', { contentId, content: 'beta' })
  expect(update.name).toBe('Preview code')
  expect(JSON.parse(update.before)).toEqual({ content: 'alpha' })
  expect(JSON.parse(update.after)).toEqual({ content: 'beta' })
  expect(db.getSnippetById(id)!.contents[0]).toMatchObject({
    label: 'Main',
    value: 'alpha',
    language: 'javascript',
  })
  const metadata = propose('update', {
    contentId,
    label: 'Renamed',
    language: 'typescript',
  })
  expect(JSON.parse(metadata.before)).toEqual({
    label: 'Main',
    language: 'javascript',
  })
  expect(JSON.parse(metadata.after)).toEqual({
    label: 'Renamed',
    language: 'typescript',
  })
  const created = propose('create', {
    label: 'Extra',
    content: 'new',
    language: 'text',
  })
  expect(JSON.parse(created.before)).toEqual({})
  expect(JSON.parse(created.after)).toEqual({
    label: 'Extra',
    content: 'new',
    language: 'plain_text',
  })
  db.createSnippetContent(id, {
    label: 'Sibling',
    value: 'keep',
    language: 'text',
  })
  const deleted = propose('delete', { contentId })
  expect(JSON.parse(deleted.before)).toEqual({
    label: 'Main',
    content: 'alpha',
    language: 'javascript',
  })
  expect(JSON.parse(deleted.after)).toEqual({})
  expect(deleted.irreversible).toBe(true)
})

it('applies ordered workspace calls and reverses their receipts while retaining an independent manual field', () => {
  const { snippets, folders } = useStorage()
  const ids = ['First', 'Second', 'Third'].map(
    name => snippets.createSnippet({ name }).id,
  )
  const destination = folders.createFolder({ name: 'Destination' }).id
  const manager = createWorkspaceManager()
  const change = (operations: ReturnType<typeof operation>[]) =>
    manager.propose(
      workspaceReviewSchema.parse({ summary: 'Organize', operations }),
    )
  const trash = operation('code', 'item', 'trash', ids[2]!)
  const restore = operation('code', 'item', 'restore', ids[2]!)
  expect(() => change([trash, restore])).toThrow('DUPLICATE_TARGET')
  const update = change(
    ids
      .slice(0, 2)
      .map(id =>
        operation('code', 'item', 'update', id, {
          folderId: destination,
          tags: ['organized'],
          isFavorites: 1,
        }),
      ),
  )
  expect(manager.apply(update.id, [0, 1]).applied).toEqual([0, 1])
  const trashed = change([trash])
  expect(manager.apply(trashed.id, [0]).applied).toEqual([0])
  expect(snippets.getSnippetById(ids[2]!)!.isDeleted).toBe(1)
  const restored = change([restore])
  expect(manager.apply(restored.id, [0]).applied).toEqual([0])
  expect(snippets.getSnippetById(ids[2]!)!.isDeleted).toBe(0)
  snippets.updateSnippet(ids[0]!, {
    description: 'Independent manual description',
  })
  for (const [id, index] of [
    [restored.id, 0],
    [trashed.id, 0],
    [update.id, 1],
    [update.id, 0],
  ] as const) {
    expect(manager.undo(id, index, true)).toEqual({
      undone: true,
      conflicts: [],
    })
  }
  for (const id of ids) {
    const item = snippets.getSnippetById(id)!
    expect(item.isDeleted).toBe(0)
    expect(item.isFavorites).toBe(0)
    expect(item.folder).toBeNull()
    expect(item.tags).toEqual([])
  }
  expect(snippets.getSnippetById(ids[0]!)!.description).toBe(
    'Independent manual description',
  )
  const hint = workspaceToolError(new Error('DUPLICATE_TARGET'))
  expect(hint).toMatchObject({
    hint: expect.stringContaining('ordered lifecycle actions'),
  })
  const description = workspaceTools.find(
    tool => tool.function.name === 'propose_workspace_changes',
  )!.function.description
  expect(description).toContain(
    'Reversible effects across calls in the same task are collected by task Undo',
  )
  expect(description).toContain(
    'do not ask for extra approval solely because a batch must be split',
  )
  expect(description).toContain(
    'explicit preview or required confirmation still applies',
  )
})

it.each(['order', 'moveAndOrder', 'move'] as const)(
  'restores Code sibling order after %s, preserving unrelated metadata',
  (mode) => {
    const { folders } = useStorage()
    const parent = folders.createFolder({ name: 'Parent' }).id
    const ids = ['A', 'B', 'C'].map(
      name => folders.createFolder({ name }).id,
    )
    const original = folders
      .getFolders()
      .map(({ id, parentId, orderIndex }) => ({ id, parentId, orderIndex }))
      .sort((a, b) => a.id - b.id)
    const manager = createWorkspaceManager()
    const proposal = manager.propose(
      workspaceReviewSchema.parse({
        summary: 'Reorder',
        operations: [
          operation('code', 'folder', 'update', ids[2]!, {
            ...(mode !== 'move' ? { orderIndex: 0 } : {}),
            ...(mode !== 'order' ? { folderId: parent } : {}),
          }),
        ],
      }),
    )
    expect(manager.apply(proposal.id, [0]).failed).toBeUndefined()
    if (mode !== 'move') {
      expect(
        folders.getFolders().find(folder => folder.id === ids[2])!.orderIndex,
      ).toBe(0)
    }
    folders.updateFolder(ids[0]!, {
      name: 'Manual A',
      defaultLanguage: 'typescript',
    })
    expect(manager.undo(proposal.id, 0, true)).toEqual({
      undone: true,
      conflicts: [],
    })
    expect(
      folders
        .getFolders()
        .map(({ id, parentId, orderIndex }) => ({ id, parentId, orderIndex }))
        .sort((a, b) => a.id - b.id),
    ).toEqual(original)
    expect(
      folders.getFolders().find(folder => folder.id === ids[0]),
    ).toMatchObject({ name: 'Manual A', defaultLanguage: 'typescript' })
  },
)
it('refuses order Undo after a manual sibling reorder without restoring an outdated sequence', () => {
  const { folders } = useStorage()
  const ids = ['A', 'B', 'C'].map(name => folders.createFolder({ name }).id)
  const manager = createWorkspaceManager()
  const proposal = manager.propose(
    workspaceReviewSchema.parse({
      summary: 'Reorder',
      operations: [
        operation('code', 'folder', 'update', ids[2]!, { orderIndex: 0 }),
      ],
    }),
  )
  manager.apply(proposal.id, [0])
  folders.updateFolder(ids[1]!, { orderIndex: 0 })
  const before = folders.getFolders()
  expect(() => manager.undo(proposal.id, 0, true)).toThrow('STALE_PROPOSAL')
  expect(
    folders.getFolders().map(({ updatedAt, ...folder }) => folder),
  ).toEqual(before.map(({ updatedAt, ...folder }) => folder))
})

it('refuses a Code folder move that would silently rename the target', () => {
  const { folders } = useStorage()
  const parent = folders.createFolder({ name: 'Parent' }).id
  folders.createFolder({ name: 'Target', parentId: parent })
  const target = folders.createFolder({ name: 'Target' }).id
  const manager = createWorkspaceManager()
  const proposal = manager.propose(
    workspaceReviewSchema.parse({
      summary: 'Move',
      operations: [
        operation('code', 'folder', 'update', target, {
          folderId: parent,
          orderIndex: 0,
        }),
      ],
    }),
  )
  const before = structuredClone(folders.getFolders())
  expect(manager.apply(proposal.id, [0]).failed).toBe(0)
  expect(
    folders.getFolders().map(({ updatedAt, ...folder }) => folder),
  ).toEqual(before.map(({ updatedAt, ...folder }) => folder))
})

it('preserves a manual sibling rename that conflicts with moving a Code folder back during Undo', () => {
  const { folders } = useStorage()
  const parent = folders.createFolder({ name: 'Parent' }).id
  const sibling = folders.createFolder({ name: 'Sibling' }).id
  const target = folders.createFolder({ name: 'Target' }).id
  const manager = createWorkspaceManager()
  const proposal = manager.propose(
    workspaceReviewSchema.parse({
      summary: 'Move',
      operations: [
        operation('code', 'folder', 'update', target, {
          folderId: parent,
          orderIndex: 0,
        }),
      ],
    }),
  )
  expect(manager.apply(proposal.id, [0]).failed).toBeUndefined()
  folders.updateFolder(sibling, { name: 'Target' })
  const before = structuredClone(folders.getFolders())
  expect(() => manager.undo(proposal.id, 0, true)).toThrow()
  expect(folders.getFolders()).toEqual(before)
  folders.updateFolder(sibling, { name: 'Manual renamed sibling' })
  expect(manager.undo(proposal.id, 0, true)).toEqual({
    undone: true,
    conflicts: [],
  })
  expect(
    folders.getFolders().find(folder => folder.id === target),
  ).toMatchObject({ name: 'Target', parentId: null })
})

it.each([true, false])(
  'checks the final name before atomically undoing Code folder move and rename (conflict=%s)',
  (conflict) => {
    const { folders } = useStorage()
    const parent = folders.createFolder({ name: 'Parent' }).id
    const sibling = folders.createFolder({ name: 'Sibling' }).id
    const target = folders.createFolder({ name: 'Original' }).id
    const manager = createWorkspaceManager()
    const proposal = manager.propose(
      workspaceReviewSchema.parse({
        summary: 'Move and rename',
        operations: [
          operation('code', 'folder', 'update', target, {
            name: 'Changed',
            folderId: parent,
            orderIndex: 0,
          }),
        ],
      }),
    )
    expect(manager.apply(proposal.id, [0]).failed).toBeUndefined()
    folders.updateFolder(sibling, { name: conflict ? 'Original' : 'Changed' })
    const before = structuredClone(folders.getFolders())
    if (conflict) {
      expect(() => manager.undo(proposal.id, 0, true)).toThrow()
      expect(folders.getFolders()).toEqual(before)
    }
    else {
      expect(manager.undo(proposal.id, 0, true)).toEqual({
        undone: true,
        conflicts: [],
      })
      expect(
        folders.getFolders().find(folder => folder.id === target),
      ).toMatchObject({ name: 'Original', parentId: null })
    }
  },
)

it('persists canonical languages through folder, initial fragment and later fragment creation', () => {
  const manager = createWorkspaceManager()
  const created = manager.create(
    creationPlan({
      summary: 'Create',
      items: [
        {
          type: 'folder',
          space: 'code',
          name: 'Sources',
          defaultLanguage: 'TypeScript',
        },
        {
          type: 'snippet',
          name: 'Sample',
          label: 'A',
          content: 'const x = 1',
          language: 'TS',
          folderOperation: 0,
        },
      ],
    }),
  )
  expect(created.failed).toBeUndefined()
  const { snippets, folders } = useStorage()
  expect(
    folders
      .getFolders()
      .find(folder => folder.id === created.containers[0]!.id)
      ?.defaultLanguage,
  ).toBe('typescript')
  const folderId = created.containers[0]!.id
  const changedDefault = apply(
    operation('code', 'folder', 'update', folderId, { defaultLanguage: 'JS' }),
    true,
  )
  expect(
    folders.getFolders().find(folder => folder.id === folderId)?.defaultLanguage,
  ).toBe('javascript')
  expect(changedDefault.manager.undo(changedDefault.proposal.id, 0)).toBe(true)
  expect(
    folders.getFolders().find(folder => folder.id === folderId)?.defaultLanguage,
  ).toBe('typescript')
  const clear = apply(
    operation('code', 'folder', 'update', folderId, { defaultLanguage: '' }),
    true,
  )
  expect(
    folders.getFolders().find(folder => folder.id === folderId)?.defaultLanguage,
  ).toBe('')
  resetRuntimeCache()
  expect(
    folders.getFolders().find(folder => folder.id === folderId)?.defaultLanguage,
  ).toBe('')
  folders.updateFolder(folderId, { name: 'Renamed sources' })
  expect(
    folders.getFolders().find(folder => folder.id === folderId)?.defaultLanguage,
  ).toBe('')
  expect(clear.manager.undo(clear.proposal.id, 0, true)).toEqual({
    undone: true,
    conflicts: [],
  })
  expect(
    folders.getFolders().find(folder => folder.id === folderId),
  ).toMatchObject({ name: 'Renamed sources', defaultLanguage: 'typescript' })
  const id = created.items[0]!.id
  expect(snippets.getSnippetById(id)!.contents[0]).toMatchObject({
    label: 'A',
    language: 'typescript',
  })
  const fragment = apply(
    operation('code', 'fragment', 'create', id, {
      label: 'B',
      content: 'Title',
      language: 'reStructuredText',
    }),
    true,
  )
  expect(snippets.getSnippetById(id)!.contents[1]).toMatchObject({
    label: 'B',
    language: 'rst',
  })
  expect(fragment.manager.undo(fragment.proposal.id, 0)).toBe(true)
  expect(snippets.getSnippetById(id)!.contents).toHaveLength(1)
})

it('preserves legacy stored languages through content-only edits, duplication and language Undo', () => {
  const { snippets } = useStorage()
  const id = snippets.createSnippet({ name: 'Legacy' }).id
  const contentId = snippets.createSnippetContent(id, {
    label: 'Old',
    value: 'before',
    language: 'legacy-custom-language',
  }).id
  const content = apply(
    operation('code', 'item', 'update', id, { contentId, content: 'after' }),
    true,
  )
  expect(snippets.getSnippetById(id)!.contents[0]).toMatchObject({
    value: 'after',
    language: 'legacy-custom-language',
  })
  expect(content.manager.undo(content.proposal.id, 0)).toBe(true)
  const manager = createWorkspaceManager()
  const copy = manager.create(
    creationPlan({
      summary: 'Copy',
      items: [{ type: 'duplicate', space: 'code', sourceId: id }],
    }),
  )
  expect(copy.failed).toBeUndefined()
  expect(snippets.getSnippetById(copy.items[0]!.id)!.contents[0]).toMatchObject(
    { value: 'before', language: 'legacy-custom-language' },
  )
  const language = apply(
    operation('code', 'fragment', 'update', id, { contentId, language: 'JS' }),
    true,
  )
  expect(snippets.getSnippetById(id)!.contents[0]!.language).toBe('javascript')
  expect(language.manager.undo(language.proposal.id, 0)).toBe(true)
  expect(snippets.getSnippetById(id)!.contents[0]!.language).toBe(
    'legacy-custom-language',
  )
})
