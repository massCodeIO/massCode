import { expect, it } from 'vitest'
import { httpObservations } from '../httpObservations'

it('derives escaped pointers and types without pretending samples are contracts', () => {
  const result = httpObservations(
    JSON.stringify({
      body: JSON.stringify({
        'id': 42,
        'a/b~': null,
        'items': [{ secret: 'never-copy' }],
      }),
    }),
  )
  expect(result?.fields).toEqual([
    { path: '', type: 'object' },
    { path: '/id', type: 'number' },
    { path: '/a~1b~0', type: 'null' },
    { path: '/items', type: 'array' },
  ])
  expect(JSON.stringify(result)).not.toContain('never-copy')
  expect(JSON.stringify(result)).not.toContain('42')
})
it('bounds large objects and does not invent a shape for malformed or absent bodies', () => {
  expect(httpObservations('invalid')).toBeUndefined()
  expect(httpObservations('{}')).toBeUndefined()
  expect(httpObservations('{"body":"broken"}')).toEqual({
    bodyFormat: 'not_parseable_as_json',
  })
  const result = httpObservations(
    JSON.stringify({
      body: Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`field${i}`, i]),
      ),
    }),
  )
  expect(result?.complete).toBe(false)
  expect(result?.fields).toHaveLength(64)
})
