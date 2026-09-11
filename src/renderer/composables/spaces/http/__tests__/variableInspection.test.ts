import { describe, expect, it } from 'vitest'
import { inspectVariables, referencedVariables } from '../variableInspection'

describe('variable inspection', () => {
  it('shows the winning value and all overridden sources in runtime order', () => {
    const [row] = inspectVariables(
      [
        { scope: 'collection', label: 'API', values: { id: 'collection' } },
        { scope: 'folder', label: 'Catalog', values: { id: 'folder' } },
        { scope: 'environment', label: 'Local', values: { id: 'environment' } },
        { scope: 'session', label: 'Session', values: { id: 'masked' } },
      ],
      ['id'],
    )
    expect(row?.current?.scope).toBe('session')
    expect(row?.overridden.map(source => source.value)).toEqual([
      'environment',
      'folder',
      'collection',
    ])
    expect(row?.used).toBe(true)
  })
  it('includes unresolved references and distinguishes empty from missing', () => {
    const rows = inspectVariables(
      [
        {
          scope: 'environment',
          label: 'Local',
          values: { empty: '', unused: 'value' },
        },
      ],
      ['missing', 'empty'],
    )
    expect(rows[0]?.name).toBe('missing')
    expect(rows[0]?.current).toBeUndefined()
    expect(rows.find(row => row.name === 'empty')?.current?.value).toBe('')
    expect(rows.find(row => row.name === 'unused')?.used).toBe(false)
  })
  it('finds distinct references with the same syntax as interpolation', () => {
    expect(
      referencedVariables(['{{ base-url }}/{{id}}', '{{id}} {{a.b}}']),
    ).toEqual(['base-url', 'id', 'a.b'])
  })
})
