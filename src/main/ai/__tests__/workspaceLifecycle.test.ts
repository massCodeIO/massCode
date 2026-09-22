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
import {
  readCurrentWorkspace,
  workspaceInventory,
  workspaceRead,
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
function apply(op: ReturnType<typeof operation>) {
  const manager = createWorkspaceManager()
  const proposal = manager.propose({ summary: 'Change', operations: [op] })
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
  const proposal = manager.propose({
    summary: 'Create tag',
    operations: [
      {
        space: 'notes',
        kind: 'tag',
        action: 'create',
        fields: { name: 'Topic' },
      },
    ],
  })
  expect(db.tags.getTags()).toEqual([])
  manager.apply(proposal.id, [0])
  const tag = db.tags.getTags()[0]!
  const noteId = db.notes.createNote({ name: 'Note' }).id
  db.notes.addTagToNote(noteId, tag.id)
  expect(() => manager.undo(proposal.id, 0)).toThrow()
  const renamed = apply(
    operation('notes', 'tag', 'update', tag.id, { name: 'Subject' }),
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
