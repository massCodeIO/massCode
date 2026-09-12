import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  httpFolders: { getHttpFolders: vi.fn(), postHttpFolders: vi.fn() },
  notes: { getNotes: vi.fn(), postNotes: vi.fn() },
  snippets: {
    getSnippets: vi.fn(),
    postSnippets: vi.fn(),
    getSnippetsById: vi.fn(),
    postSnippetsByIdContents: vi.fn(),
    patchSnippetsByIdContentsByContentId: vi.fn(),
  },
  httpRequests: { getHttpRequests: vi.fn(), postHttpRequests: vi.fn() },
}))
vi.mock('@/services/api', () => ({ api: mock }))
vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation: vi.fn(),
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))

const {
  createNoteOperation,
  createSnippetOperation,
  createHttpRequestOperation,
  getPlannedHttpCollection,
} = await import('../createPlannedTarget')

beforeEach(() => {
  vi.resetAllMocks()
  mock.notes.getNotes.mockResolvedValue({ data: [] })
  mock.notes.postNotes.mockResolvedValue({ data: { id: 11 } })
  mock.snippets.getSnippets.mockResolvedValue({ data: [] })
  mock.snippets.postSnippets.mockResolvedValue({ data: { id: 12 } })
  mock.snippets.getSnippetsById.mockResolvedValue({ data: { contents: [] } })
  mock.snippets.postSnippetsByIdContents.mockResolvedValue({
    data: { id: 13 },
  })
  mock.snippets.patchSnippetsByIdContentsByContentId.mockResolvedValue({})
  mock.httpRequests.getHttpRequests.mockResolvedValue({ data: [] })
  mock.httpRequests.postHttpRequests.mockResolvedValue({ data: { id: 14 } })
})

describe('planned target creation', () => {
  it('creates a note in Inbox with the requested name', async () => {
    await expect(createNoteOperation({ name: '  Named ' }).run()).resolves.toBe(
      11,
    )
    expect(mock.notes.postNotes).toHaveBeenCalledWith({
      folderId: null,
      name: 'Named',
    })
    expect(mock.notes.getNotes).toHaveBeenCalledWith({
      isInbox: 1,
      isDeleted: 0,
    })
  })
  it('keeps indexed whitespace naming rules and ignores other folders', async () => {
    mock.notes.getNotes.mockResolvedValue({
      data: [
        { name: 'notes.untitled   4', folder: null },
        { name: 'notes.untitled 99', folder: { id: 42 } },
      ],
    })
    await createNoteOperation({}).run()
    expect(mock.notes.postNotes).toHaveBeenCalledWith({
      folderId: null,
      name: 'notes.untitled 5',
    })
  })
  it('creates one plain text fragment in Inbox', async () => {
    const operation = createSnippetOperation({})
    await expect(operation.run()).resolves.toBe(12)
    expect(operation.state).toEqual({
      id: 12,
      fragmentId: 13,
      uncertain: false,
    })
    expect(mock.snippets.postSnippetsByIdContents).toHaveBeenCalledWith('12', {
      label: 'common.fragment 1',
      value: '',
      language: 'plain_text',
    })
    await operation.run()
    expect(mock.snippets.postSnippets).toHaveBeenCalledTimes(1)
    expect(mock.snippets.postSnippetsByIdContents).toHaveBeenCalledTimes(1)
  })
  it('retains the confirmed snippet and retries a definitely rejected fragment', async () => {
    mock.snippets.postSnippetsByIdContents.mockRejectedValueOnce({
      response: { status: 400 },
    })
    const operation = createSnippetOperation({})
    await expect(operation.run()).rejects.toEqual({
      response: { status: 400 },
    })
    expect(operation.state.id).toBe(12)
    await expect(operation.run()).resolves.toBe(12)
    expect(mock.snippets.postSnippets).toHaveBeenCalledTimes(1)
  })
  it('reconciles a lost fragment response without posting again', async () => {
    mock.snippets.postSnippetsByIdContents.mockRejectedValueOnce(
      new Error('network'),
    )
    const operation = createSnippetOperation({})
    await expect(operation.run()).rejects.toThrow('network')
    await expect(operation.run()).rejects.toThrow('reconciliation')
    mock.snippets.getSnippetsById.mockResolvedValue({
      data: { contents: [{ id: 13 }] },
    })
    await expect(operation.reconcileFragment()).resolves.toBe(true)
    await expect(operation.run()).resolves.toBe(12)
    expect(mock.snippets.postSnippetsByIdContents).toHaveBeenCalledTimes(1)
  })
  it('does not repeat an uncertain record POST or an unreconciled fragment POST', async () => {
    mock.snippets.postSnippets.mockRejectedValueOnce(new Error('network'))
    const operation = createSnippetOperation({})
    await expect(operation.run()).rejects.toThrow()
    await expect(operation.run()).rejects.toThrow('reconciliation')
    expect(mock.snippets.postSnippets).toHaveBeenCalledTimes(1)
  })
  it('keeps identity when initialization GET fails, and retries only initialization', async () => {
    mock.snippets.getSnippetsById.mockRejectedValueOnce(
      new Error('read failed'),
    )
    const operation = createSnippetOperation({})
    await expect(operation.run()).rejects.toThrow('read failed')
    expect(operation.state.id).toBe(12)
    await expect(operation.run()).resolves.toBe(12)
    expect(mock.snippets.postSnippets).toHaveBeenCalledTimes(1)
    expect(mock.snippets.postSnippetsByIdContents).toHaveBeenCalledTimes(1)
  })
  it('does not retry an uncertain fragment when reconciliation finds none', async () => {
    mock.snippets.postSnippetsByIdContents.mockRejectedValueOnce(
      new Error('network'),
    )
    const operation = createSnippetOperation({})
    await expect(operation.run()).rejects.toThrow()
    await expect(operation.reconcileFragment()).resolves.toBe(false)
    await expect(operation.run()).rejects.toThrow('reconciliation')
    expect(mock.snippets.postSnippetsByIdContents).toHaveBeenCalledTimes(1)
  })
  it('requires persisted current fragment fields after a cached GET from a failed POST', async () => {
    mock.snippets.postSnippetsByIdContents.mockRejectedValueOnce({
      response: { status: 500 },
    })
    const operation = createSnippetOperation({})
    await expect(operation.run()).rejects.toEqual({
      response: { status: 500 },
    })
    const current = {
      id: 13,
      label: 'Edited',
      language: 'javascript',
      value: 'const keep = 1',
    }
    mock.snippets.getSnippetsById.mockResolvedValue({
      data: { contents: [current] },
    })
    mock.snippets.patchSnippetsByIdContentsByContentId.mockRejectedValueOnce(
      new Error('disk full'),
    )
    await expect(operation.reconcileFragment()).rejects.toThrow('disk full')
    expect(operation.state.fragmentId).toBeUndefined()
    expect(operation.state.uncertain).toBe(true)
    await expect(operation.reconcileFragment()).resolves.toBe(true)
    await expect(operation.run()).resolves.toBe(12)
    expect(
      mock.snippets.patchSnippetsByIdContentsByContentId,
    ).toHaveBeenLastCalledWith('12', '13', {
      label: 'Edited',
      language: 'javascript',
      value: 'const keep = 1',
    })
    expect(mock.snippets.postSnippetsByIdContents).toHaveBeenCalledTimes(1)
    expect(mock.snippets.postSnippets).toHaveBeenCalledTimes(1)
  })
  it('serializes repeat submissions', async () => {
    const operation = createSnippetOperation({})
    await Promise.all([operation.run(), operation.run()])
    expect(mock.snippets.postSnippets).toHaveBeenCalledTimes(1)
  })
  it('creates HTTP in the Inbox collection with API defaults', async () => {
    await createHttpRequestOperation({ folderId: 42, name: 'Test' }).run()
    expect(mock.httpRequests.postHttpRequests).toHaveBeenCalledWith({
      folderId: 42,
      name: 'Test',
    })
  })
})

describe.each(['note', 'http'] as const)('%s creation checkpoint', (kind) => {
  function setupOperation() {
    return kind === 'note'
      ? {
          operation: createNoteOperation({}),
          post: mock.notes.postNotes,
          get: mock.notes.getNotes,
        }
      : {
          operation: createHttpRequestOperation({ folderId: 42 }),
          post: mock.httpRequests.postHttpRequests,
          get: mock.httpRequests.getHttpRequests,
        }
  }
  it('coalesces repeated submissions and reuses a confirmed ID', async () => {
    const { operation, post } = setupOperation()
    await Promise.all([operation.run(), operation.run()])
    const id = operation.state.id
    await expect(operation.run()).resolves.toBe(id)
    expect(post).toHaveBeenCalledTimes(1)
  })
  it('refuses to repeat an unknown POST outcome or missing identity', async () => {
    const first = setupOperation()
    first.post.mockRejectedValueOnce(new Error('network'))
    await expect(first.operation.run()).rejects.toThrow('network')
    await expect(first.operation.run()).rejects.toThrow('CREATION_UNCERTAIN')
    expect(first.post).toHaveBeenCalledTimes(1)
    const missing = setupOperation()
    missing.post.mockResolvedValueOnce({ data: {} })
    await expect(missing.operation.run()).rejects.toThrow('CREATION_UNCERTAIN')
    await expect(missing.operation.run()).rejects.toThrow('CREATION_UNCERTAIN')
    expect(missing.post).toHaveBeenCalledTimes(2)
  })
  it('can retry a read failure and a definite rejected POST', async () => {
    const { operation, post, get } = setupOperation()
    get.mockRejectedValueOnce(new Error('read'))
    await expect(operation.run()).rejects.toThrow('read')
    expect(post).not.toHaveBeenCalled()
    expect(operation.state.uncertain).toBe(false)
    post.mockRejectedValueOnce({ response: { status: 400 } })
    await expect(operation.run()).rejects.toEqual({
      response: { status: 400 },
    })
    expect(operation.state.uncertain).toBe(false)
    await operation.run()
    expect(post).toHaveBeenCalledTimes(2)
  })
})

it.each(['note', 'snippet', 'http'] as const)(
  'checks current destination names when activating a planned %s',
  async (type) => {
    const get
      = type === 'note'
        ? mock.notes.getNotes
        : type === 'snippet'
          ? mock.snippets.getSnippets
          : mock.httpRequests.getHttpRequests
    const post
      = type === 'note'
        ? mock.notes.postNotes
        : type === 'snippet'
          ? mock.snippets.postSnippets
          : mock.httpRequests.postHttpRequests
    const folderId = type === 'http' ? 7 : null
    const operation
      = type === 'http'
        ? createHttpRequestOperation({ name: 'Example', folderId: 7 })
        : (type === 'note' ? createNoteOperation : createSnippetOperation)({
            name: 'Example',
          })
    // Items may appear after planning, before the operation is run.
    get.mockResolvedValue({
      data: [
        { name: 'Example', folder: null, folderId },
        { name: 'Example 1', folder: null, folderId },
        { name: 'Example 99', folder: { id: 42 }, folderId: 42 },
      ],
    })
    await operation.run()
    expect(post).toHaveBeenCalledWith({ folderId, name: 'Example 2' })
  },
)

it('reuses only the Inbox HTTP collection', async () => {
  mock.httpFolders.getHttpFolders.mockResolvedValue({
    data: [
      { id: 1, name: 'internalLinks.planned.httpCollection', parentId: 99 },
      { id: 2, name: 'internalLinks.planned.httpCollection', parentId: null },
    ],
  })
  await expect(getPlannedHttpCollection(vi.fn())).resolves.toBe(2)
  expect(mock.httpFolders.postHttpFolders).not.toHaveBeenCalled()
})
it('creates the missing Inbox HTTP collection once for simultaneous activations', async () => {
  mock.httpFolders.getHttpFolders.mockResolvedValue({ data: [] })
  mock.httpFolders.postHttpFolders.mockResolvedValue({ data: { id: 42 } })
  const check = vi.fn()
  await expect(
    Promise.all([
      getPlannedHttpCollection(check),
      getPlannedHttpCollection(check),
    ]),
  ).resolves.toEqual([42, 42])
  expect(mock.httpFolders.postHttpFolders).toHaveBeenCalledExactlyOnceWith({
    name: 'internalLinks.planned.httpCollection',
    parentId: null,
  })
  expect(check).toHaveBeenCalledOnce()
})
