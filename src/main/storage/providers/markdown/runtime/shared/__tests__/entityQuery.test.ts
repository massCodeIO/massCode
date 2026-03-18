import { describe, expect, it } from 'vitest'
import { filterAndSortByQuery } from '../entityQuery'

interface TestEntity {
  id: number
  isDeleted: number
  score: number
}

describe('filterAndSortByQuery', () => {
  it('applies all filters sequentially', () => {
    const entities: TestEntity[] = [
      { id: 1, isDeleted: 0, score: 3 },
      { id: 2, isDeleted: 1, score: 2 },
      { id: 3, isDeleted: 0, score: 1 },
    ]

    const result = filterAndSortByQuery({
      entities,
      filters: [
        entity => entity.isDeleted === 0,
        entity => entity.id !== 1,
      ],
      getSortValue: entity => entity.score,
      query: {},
    })

    expect(result.map(entity => entity.id)).toEqual([3])
  })

  it('sorts ascending when order is ASC', () => {
    const entities: TestEntity[] = [
      { id: 1, isDeleted: 0, score: 30 },
      { id: 2, isDeleted: 0, score: 10 },
      { id: 3, isDeleted: 0, score: 20 },
    ]

    const result = filterAndSortByQuery({
      entities,
      filters: [],
      getSortValue: entity => entity.score,
      query: { order: 'ASC' as const },
    })

    expect(result.map(entity => entity.id)).toEqual([2, 3, 1])
  })

  it('sorts descending by default and when order is DESC', () => {
    const entities: TestEntity[] = [
      { id: 1, isDeleted: 0, score: 30 },
      { id: 2, isDeleted: 0, score: 10 },
      { id: 3, isDeleted: 0, score: 20 },
    ]

    const defaultOrderResult = filterAndSortByQuery({
      entities,
      filters: [],
      getSortValue: entity => entity.score,
      query: {},
    })
    const descOrderResult = filterAndSortByQuery({
      entities,
      filters: [],
      getSortValue: entity => entity.score,
      query: { order: 'DESC' as const },
    })

    expect(defaultOrderResult.map(entity => entity.id)).toEqual([1, 3, 2])
    expect(descOrderResult.map(entity => entity.id)).toEqual([1, 3, 2])
  })
})
