import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { emptyHttpCollection } from '~/shared/httpCollection'

Object.assign(globalThis, { computed, reactive, ref, shallowRef, watch })

async function setup() {
  vi.resetModules()
  const httpState = reactive({
    activePanel: 'folder',
    folderId: 2,
    libraryFilter: undefined,
  })
  const records = [1, 2].map(id => ({
    id,
    name: `Collection ${id}`,
    parentId: null,
    icon: null,
    createdAt: 1,
    updatedAt: 1,
    isOpen: 1,
    orderIndex: id - 1,
    children: [],
    collectionConfig: emptyHttpCollection(),
  }))
  const patch = vi.fn(async () => ({}))
  vi.doMock('../useHttpApp', () => ({ useHttpApp: () => ({ httpState }) }))
  vi.doMock('../useHttpRuntime', () => ({ useHttpRuntime: () => ({}) }))
  vi.doMock('../useHttpRequests', () => ({
    useHttpRequests: () => ({}),
    selectHttpRequest: vi.fn(),
  }))
  vi.doMock('@/composables/useDialog', () => ({
    useDialog: () => ({ confirm: vi.fn() }),
  }))
  vi.doMock('@/composables/useStorageMutation', () => ({
    markPersistedStorageMutation: vi.fn(),
  }))
  vi.doMock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
  vi.doMock('@/utils', () => ({
    getContiguousSelection: vi.fn(),
    scrollToElement: vi.fn(),
  }))
  vi.doMock('@/services/api', () => ({
    api: {
      httpFolders: {
        getHttpFoldersTree: vi.fn(async () => ({
          data: structuredClone(records),
        })),
        patchHttpFoldersById: patch,
      },
    },
  }))
  const { useHttpFolders } = await import('../useHttpFolders')
  const folders = useHttpFolders()
  await folders.getHttpFolders(false)
  const { useHttpCollection } = await import('../useHttpCollection')
  const collection = useHttpCollection()
  const { httpRuntimeNavigation } = await import('../runtimeNavigation')
  return {
    httpState,
    folders,
    collection,
    httpRuntimeNavigation,
    patch,
    records,
  }
}

beforeEach(() => vi.restoreAllMocks())

describe('collection document state', () => {
  it('opens nested folder settings with inherited auth and saves their own configuration', async () => {
    const { folders, collection, patch } = await setup()
    const folder = folders.folders.value.find(folder => folder.id === 2)!
    folder.parentId = 1
    delete folder.collectionConfig
    // Folder metadata is shallow: publish a new tree after changing its ancestry.
    folders.folders.value = folders.folders.value.map(item => ({ ...item }))
    await nextTick()
    expect(collection.collection.value?.id).toBe(2)
    expect(collection.draft.value.auth.type).toBe('inherit')
    collection.draft.value.documentation = 'Folder documentation'
    await collection.save()
    expect(patch).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({
        collectionConfig: expect.objectContaining({
          documentation: 'Folder documentation',
          auth: { type: 'inherit' },
        }),
      }),
    )
  })

  it('preserves the dirty active collection when multiselection is reordered on tree refresh', async () => {
    const { folders, collection, httpState } = await setup()
    collection.draft.value.documentation = 'Draft of collection B'
    folders.selectedFolderIds.value = [2, 1]
    await folders.getHttpFolders(false)
    await nextTick()
    expect(folders.selectedFolderIds.value).toEqual([1, 2])
    expect(httpState.folderId).toBe(2)
    expect(collection.collection.value?.id).toBe(2)
    expect(collection.draft.value.documentation).toBe('Draft of collection B')
    expect(collection.dirty.value).toBe(true)
  })

  it('ignores a hidden invalid expected input after switching to an operator without expected', async () => {
    const { collection } = await setup()
    collection.draft.value.runtime.assertions.push({
      name: 'Status exists',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    collection.runtimeContext.setExpected(0, '{invalid')
    expect(collection.valid.value).toBe(false)
    collection.draft.value.runtime.assertions[0]!.operator = 'exists'
    expect(collection.valid.value).toBe(true)
  })

  it('shows validation only after saving and clears it when the field is corrected', async () => {
    const { collection, patch } = await setup()
    collection.draft.value.runtime.extractions.push({
      name: '',
      source: 'json',
      path: '',
    })
    expect(collection.valid.value).toBe(false)
    expect(collection.submitted.value).toBe(false)
    expect(
      collection.runtimeContext.fieldError('extractions', 0, 'name'),
    ).toBeUndefined()
    collection.runtimeContext.touchField()
    expect(
      collection.runtimeContext.fieldError('extractions', 0, 'name'),
    ).toBeUndefined()
    expect(await collection.save()).toBe(false)
    expect(patch).not.toHaveBeenCalled()
    expect(collection.submitted.value).toBe(true)
    expect(
      collection.runtimeContext.fieldError('extractions', 0, 'name'),
    ).toBeDefined()
    collection.draft.value.runtime.extractions[0]!.name = 'token'
    expect(
      collection.runtimeContext.fieldError('extractions', 0, 'name'),
    ).toBeUndefined()
    expect(await collection.save()).toBe(true)
    collection.discard()
    expect(collection.submitted.value).toBe(false)
  })

  it('retains the owner and dirty draft on save failure and allows cancelling navigation', async () => {
    const { collection, patch, httpRuntimeNavigation } = await setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    patch.mockRejectedValueOnce(new Error('offline'))
    collection.draft.value.documentation = 'Keep this'
    const leaving = httpRuntimeNavigation.confirmCollectionLeave!()
    await collection.resolveNavigation('save')
    expect(collection.leaveDialogOpen.value).toBe(true)
    expect(collection.saveError.value).toBe(true)
    expect(collection.collection.value?.id).toBe(2)
    expect(collection.draft.value.documentation).toBe('Keep this')
    await collection.resolveNavigation('cancel')
    expect(await leaving).toBe(false)
    expect(collection.dirty.value).toBe(true)
  })
  it.each([false, true])(
    'retains the disappeared collection draft and active owner (empty tree: %s)',
    async (emptyTree) => {
      const {
        folders,
        collection,
        httpState,
        records,
        patch,
        httpRuntimeNavigation,
      } = await setup()
      const original = structuredClone(records)
      collection.draft.value.documentation = 'Unsaved collection work'
      records.splice(emptyTree ? 0 : 1)
      await folders.getHttpFolders(false)
      expect(httpState.folderId).toBe(2)
      expect(httpState.activePanel).toBe('folder')
      expect(collection.collection.value?.id).toBe(2)
      expect(collection.missing.value).toBe(true)
      expect(collection.unavailable.value).toBe(true)
      expect(collection.draft.value.documentation).toBe(
        'Unsaved collection work',
      )
      expect(await collection.save()).toBe(false)
      expect(patch).not.toHaveBeenCalled()
      const leaving = httpRuntimeNavigation.confirmCollectionLeave!()
      await collection.resolveNavigation('cancel')
      expect(await leaving).toBe(false)
      expect(collection.dirty.value).toBe(true)
      records.splice(0, records.length, ...original)
      await folders.getHttpFolders(false)
      expect(collection.missing.value).toBe(false)
      expect(collection.draft.value.documentation).toBe(
        'Unsaved collection work',
      )
      expect(await collection.save()).toBe(true)
      expect(collection.dirty.value).toBe(false)
      expect(patch).toHaveBeenCalledWith('2', expect.anything())
    },
  )
  it('discards the orphan only through confirmed navigation and resets it when changing vault', async () => {
    const { folders, collection, httpState, records, httpRuntimeNavigation }
      = await setup()
    collection.draft.value.documentation = 'Orphan draft'
    records.pop()
    await folders.getHttpFolders(false)
    const leaving = httpRuntimeNavigation.confirmCollectionLeave!()
    await collection.resolveNavigation('discard')
    expect(await leaving).toBe(true)
    httpState.folderId = 1
    expect(collection.collection.value?.id).toBe(1)
    expect(collection.dirty.value).toBe(false)
    expect(collection.draft.value.documentation).toBe('')
    collection.draft.value.documentation = 'Old vault content'
    collection.reset()
    folders.resetHttpFoldersState()
    expect(collection.dirty.value).toBe(false)
    expect(collection.collection.value).toBeNull()
    expect(collection.draft.value.documentation).toBe('')
  })

  it('retains a draft if its owner disappears while saving', async () => {
    const { folders, collection, patch, records } = await setup()
    collection.draft.value.documentation = 'Saving collection work'
    let finish!: () => void
    patch.mockImplementationOnce(
      () => new Promise(resolve => (finish = () => resolve({}))),
    )
    const pending = collection.save()
    records.pop()
    await folders.getHttpFolders(false)
    finish()
    expect(await pending).toBe(false)
    expect(collection.dirty.value).toBe(true)
    expect(collection.missing.value).toBe(true)
    expect(collection.draft.value.documentation).toBe('Saving collection work')
  })
})
