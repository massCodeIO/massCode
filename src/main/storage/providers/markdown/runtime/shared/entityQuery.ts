interface QueryWithOrder {
  order?: 'ASC' | 'DESC'
}

interface FilterAndSortByQueryInput<TEntity, TQuery extends QueryWithOrder> {
  entities: TEntity[]
  filters: Array<(entity: TEntity, query: TQuery) => boolean>
  getSortValue: (entity: TEntity) => number
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
      const left = input.getSortValue(a)
      const right = input.getSortValue(b)
      return order === 'ASC' ? left - right : right - left
    })
}
