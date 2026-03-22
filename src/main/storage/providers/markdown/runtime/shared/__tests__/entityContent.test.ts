import { describe, expect, it } from 'vitest'
import {
  createNestedContent,
  deleteNestedContent,
  updateEntityBodyContent,
  updateNestedContent,
} from '../entityContent'

interface Owner {
  id: number
  updatedAt: number
  contents: Array<{
    id: number
    label: string
    value: string | null
  }>
}

describe('updateEntityBodyContent', () => {
  it('returns notFound=true when entity is missing', () => {
    const result = updateEntityBodyContent({
      content: 'next',
      entity: undefined,
      persistEntity: () => {},
    })

    expect(result).toEqual({ notFound: true })
  })

  it('updates content, touches updatedAt and persists', () => {
    const entity = {
      content: 'old',
      updatedAt: 1,
    }
    let persisted = false

    const result = updateEntityBodyContent({
      content: 'new',
      entity,
      onAfterPersist: () => {
        persisted = true
      },
      persistEntity: () => {
        persisted = true
      },
    })

    expect(result).toEqual({ notFound: false })
    expect(entity.content).toBe('new')
    expect(entity.updatedAt).toBeGreaterThan(1)
    expect(persisted).toBe(true)
  })
})

describe('createNestedContent', () => {
  it('throws through onOwnerNotFound when owner is missing', () => {
    const error = new Error('SNIPPET_NOT_FOUND')

    expect(() =>
      createNestedContent({
        createContent: id => ({ id, label: 'L', value: null }),
        nextContentId: () => 1,
        onOwnerNotFound: () => {
          throw error
        },
        owner: undefined,
        persistOwner: () => {},
      }),
    ).toThrow(error)
  })

  it('appends nested content, updates owner timestamp and persists', () => {
    const owner: Owner = {
      contents: [],
      id: 1,
      updatedAt: 1,
    }
    let persisted = 0

    const result = createNestedContent({
      createContent: id => ({ id, label: 'L', value: null }),
      nextContentId: () => 5,
      onOwnerNotFound: () => {
        throw new Error('should not happen')
      },
      owner,
      persistOwner: () => {
        persisted += 1
      },
    })

    expect(result).toEqual({ id: 5 })
    expect(owner.contents).toEqual([{ id: 5, label: 'L', value: null }])
    expect(owner.updatedAt).toBeGreaterThan(1)
    expect(persisted).toBe(1)
  })
})

describe('updateNestedContent', () => {
  it('returns invalidInput=true when patch has no fields', () => {
    const owner: Owner = {
      contents: [{ id: 1, label: 'A', value: 'x' }],
      id: 1,
      updatedAt: 1,
    }

    const result = updateNestedContent({
      applyPatch: () => {},
      findTargetOwnerById: () => owner,
      hasAnyField: () => false,
      ownerId: 1,
      ownedContent: { contentIndex: 0, owner },
      patch: {},
      persistOwner: () => {},
    })

    expect(result).toEqual({
      invalidInput: true,
      notFound: false,
      parentNotFound: false,
    })
  })

  it('updates owner content when parent is the same owner', () => {
    const owner: Owner = {
      contents: [{ id: 1, label: 'A', value: 'x' }],
      id: 1,
      updatedAt: 1,
    }
    let persisted = 0

    const result = updateNestedContent({
      applyPatch: (content, patch: { label?: string }) => {
        if (patch.label !== undefined) {
          content.label = patch.label
        }
      },
      findTargetOwnerById: () => owner,
      hasAnyField: patch => 'label' in patch,
      ownerId: 1,
      ownedContent: { contentIndex: 0, owner },
      patch: { label: 'B' },
      persistOwner: () => {
        persisted += 1
      },
    })

    expect(result).toEqual({
      invalidInput: false,
      notFound: false,
      parentNotFound: false,
    })
    expect(owner.contents[0].label).toBe('B')
    expect(owner.updatedAt).toBeGreaterThan(1)
    expect(persisted).toBe(1)
  })

  it('returns parentNotFound=true when owner differs and target owner is missing', () => {
    const owner: Owner = {
      contents: [{ id: 1, label: 'A', value: 'x' }],
      id: 2,
      updatedAt: 1,
    }
    let persisted = 0

    const result = updateNestedContent({
      applyPatch: () => {},
      findTargetOwnerById: () => undefined,
      hasAnyField: patch => 'label' in patch,
      ownerId: 1,
      ownedContent: { contentIndex: 0, owner },
      patch: { label: 'B' },
      persistOwner: () => {
        persisted += 1
      },
    })

    expect(result).toEqual({
      invalidInput: false,
      notFound: false,
      parentNotFound: true,
    })
    expect(persisted).toBe(1)
  })
})

describe('deleteNestedContent', () => {
  it('returns deleted=false when owned content is missing', () => {
    const result = deleteNestedContent({
      ownedContent: undefined,
      persistOwner: () => {},
    })

    expect(result).toEqual({ deleted: false })
  })

  it('removes content, updates owner timestamp and persists', () => {
    const owner: Owner = {
      contents: [{ id: 1, label: 'A', value: 'x' }],
      id: 1,
      updatedAt: 1,
    }
    let persisted = 0

    const result = deleteNestedContent({
      ownedContent: {
        contentIndex: 0,
        owner,
      },
      persistOwner: () => {
        persisted += 1
      },
    })

    expect(result).toEqual({ deleted: true })
    expect(owner.contents).toEqual([])
    expect(owner.updatedAt).toBeGreaterThan(1)
    expect(persisted).toBe(1)
  })
})
