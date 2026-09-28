interface QueryWithOrder {
  order?: 'ASC' | 'DESC'
  sort?: string
}

interface FilterAndSortByQueryInput<TEntity, TQuery extends QueryWithOrder> {
  entities: TEntity[]
  filters: Array<(entity: TEntity, query: TQuery) => boolean>
  getSortValue: (entity: TEntity, sort?: string) => number | string
  query: TQuery
}

export function filterAndSortByQuery<TEntity, TQuery extends QueryWithOrder>(
  input: FilterAndSortByQueryInput<TEntity, TQuery>,
): TEntity[] {
  const order = input.query.order === 'ASC' ? 'ASC' : 'DESC'

  return input.entities
    .filter(entity =>
      input.filters.every(filter => filter(entity, input.query)),
    )
    .sort((a, b) => {
      const left = input.getSortValue(a, input.query.sort)
      const right = input.getSortValue(b, input.query.sort)
      const result
        = typeof left === 'string' || typeof right === 'string'
          ? String(left).localeCompare(String(right))
          : left - right

      return order === 'ASC' ? result : -result
    })
}
