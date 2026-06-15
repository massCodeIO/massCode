import { describe, expect, it } from 'vitest'
import { filterAndSortByQuery } from '../entityQuery'

interface TestEntity {
  id: number
  isDeleted: number
  name: string
  score: number
}

describe('filterAndSortByQuery', () => {
  it('applies all filters sequentially', () => {
    const entities: TestEntity[] = [
      { id: 1, isDeleted: 0, name: 'Charlie', score: 3 },
      { id: 2, isDeleted: 1, name: 'Bravo', score: 2 },
      { id: 3, isDeleted: 0, name: 'Alpha', score: 1 },
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
      { id: 1, isDeleted: 0, name: 'Charlie', score: 30 },
      { id: 2, isDeleted: 0, name: 'Bravo', score: 10 },
      { id: 3, isDeleted: 0, name: 'Alpha', score: 20 },
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
      { id: 1, isDeleted: 0, name: 'Charlie', score: 30 },
      { id: 2, isDeleted: 0, name: 'Bravo', score: 10 },
      { id: 3, isDeleted: 0, name: 'Alpha', score: 20 },
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

  it('sorts string values', () => {
    const entities: TestEntity[] = [
      { id: 1, isDeleted: 0, name: 'Charlie', score: 30 },
      { id: 2, isDeleted: 0, name: 'bravo', score: 10 },
      { id: 3, isDeleted: 0, name: 'Alpha', score: 20 },
    ]

    const ascResult = filterAndSortByQuery({
      entities,
      filters: [],
      getSortValue: entity => entity.name.toLowerCase(),
      query: { order: 'ASC' as const },
    })
    const descResult = filterAndSortByQuery({
      entities,
      filters: [],
      getSortValue: entity => entity.name.toLowerCase(),
      query: { order: 'DESC' as const },
    })

    expect(ascResult.map(entity => entity.id)).toEqual([3, 2, 1])
    expect(descResult.map(entity => entity.id)).toEqual([1, 2, 3])
  })
})
