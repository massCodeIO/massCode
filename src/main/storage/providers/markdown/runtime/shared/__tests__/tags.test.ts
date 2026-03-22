import { describe, expect, it, vi } from 'vitest'
import {
  createTagInState,
  deleteTagFromStateAndEntities,
  getSortedTagRecords,
  updateTagInState,
} from '../tags'

describe('getSortedTagRecords', () => {
  it('returns id/name sorted by name', () => {
    const result = getSortedTagRecords([
      { id: 2, name: 'zeta' },
      { id: 1, name: 'alpha' },
    ])

    expect(result).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'zeta' },
    ])
  })
})

describe('createTagInState', () => {
  it('increments counter and appends tag', () => {
    const state = {
      counters: { tagId: 0 },
      tags: [] as {
        createdAt: number
        id: number
        name: string
        updatedAt: number
      }[],
    }

    const result = createTagInState(state, 'new-tag', ({ id, name, now }) => ({
      createdAt: now,
      id,
      name,
      updatedAt: now,
    }))

    expect(result).toEqual({ id: 1 })
    expect(state.counters.tagId).toBe(1)
    expect(state.tags).toHaveLength(1)
    expect(state.tags[0].name).toBe('new-tag')
  })
})

describe('updateTagInState', () => {
  it('updates tag name and timestamp', () => {
    const state = {
      tags: [
        {
          createdAt: 1,
          id: 1,
          name: 'old',
          updatedAt: 1,
        },
      ],
    }
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(42)

    const result = updateTagInState(state.tags, 1, 'new')

    expect(result).toEqual({ notFound: false })
    expect(state.tags[0].name).toBe('new')
    expect(state.tags[0].updatedAt).toBe(42)

    nowSpy.mockRestore()
  })

  it('returns notFound for missing tag', () => {
    const result = updateTagInState([], 999, 'name')
    expect(result).toEqual({ notFound: true })
  })
})

describe('deleteTagFromStateAndEntities', () => {
  it('removes tag from state and all entities', () => {
    const state = {
      tags: [{ id: 1 }, { id: 2 }],
    }
    const entities = [{ tags: [1, 2] }, { tags: [2] }, { tags: [] }]
    const onEntityUpdated = vi.fn()

    const result = deleteTagFromStateAndEntities(
      state,
      entities,
      2,
      onEntityUpdated,
    )

    expect(result).toEqual({ deleted: true })
    expect(state.tags).toEqual([{ id: 1 }])
    expect(entities[0].tags).toEqual([1])
    expect(entities[1].tags).toEqual([])
    expect(entities[2].tags).toEqual([])
    expect(onEntityUpdated).toHaveBeenCalledTimes(2)
  })

  it('returns deleted false when tag does not exist', () => {
    const result = deleteTagFromStateAndEntities(
      { tags: [{ id: 1 }] },
      [{ tags: [1] }],
      99,
      vi.fn(),
    )

    expect(result).toEqual({ deleted: false })
  })
})
