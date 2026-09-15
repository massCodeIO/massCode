import { benchmark } from '@/electron'

const searched = new Map<string, Set<string>>()
export function benchmarkStart(
  space: 'code' | 'notes' | 'http',
  operation: 'list' | 'open' | 'sidebar-filter',
  search?: string,
) {
  if (typeof window === 'undefined' || !benchmark?.enabled)
    return (_status?: 'ok' | 'error' | 'superseded') => {}
  let label: string = operation
  if (search) {
    const queries = searched.get(space) || new Set<string>()
    label = queries.has(search)
      ? 'search-repeat'
      : queries.size
        ? 'search-new'
        : 'search-first'
    queries.add(search)
    searched.set(space, queries)
  }
  const start = performance.now()
  let finished = false
  return (status: 'ok' | 'error' | 'superseded' = 'ok') => {
    if (finished)
      return
    finished = true
    void nextTick().then(() => {
      requestAnimationFrame(() => {
        void benchmark
          .record({
            name: `${space}.${label}.state-presented`,
            durationMs: performance.now() - start,
            status,
          })
          .catch(() => {})
      })
    })
  }
}
