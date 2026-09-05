import { describe, expect, it } from 'vitest'
import {
  emptyHttpRuntime,
  httpRuntimeSchema,
  isHttpRuntime,
} from '../httpRuntime'

describe('hTTP runtime schema', () => {
  it('accepts existing version 1 data without coercion or mutation', () => {
    const runtime = emptyHttpRuntime()
    runtime.extractions.push({ name: 'token', source: 'json', path: '' })
    runtime.assertions.push({
      name: ' Status ',
      source: 'status',
      operator: 'eq',
      expected: 200,
    })
    expect(httpRuntimeSchema.parse(runtime)).toEqual(runtime)
  })

  it.each(['', '/args/demo', '/a~1b/~0key'])(
    'accepts JSON pointer %s',
    (path) => {
      expect(
        isHttpRuntime({
          ...emptyHttpRuntime(),
          extractions: [{ name: 'demo', source: 'json', path }],
        }),
      ).toBe(true)
    },
  )

  it.each(['args/demo', '/a~', '/a~2b'])(
    'reports invalid pointer %s at the field',
    (path) => {
      const result = httpRuntimeSchema.safeParse({
        ...emptyHttpRuntime(),
        extractions: [{ name: 'demo', source: 'json', path }],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            path: ['extractions', 0, 'path'],
            message: 'pointer',
          }),
        )
      }
    },
  )

  it('reports duplicate names on both rows', () => {
    const result = httpRuntimeSchema.safeParse({
      ...emptyHttpRuntime(),
      extractions: [0, 1].map(() => ({
        name: 'demo',
        source: 'json',
        path: '',
      })),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path)).toEqual([
        ['extractions', 0, 'name'],
        ['extractions', 1, 'name'],
      ])
    }
  })

  it.each(['', ' ', '__proto__', 'a b', 'a'.repeat(257)])(
    'rejects invalid variable name %s',
    (name) => {
      expect(
        isHttpRuntime({
          ...emptyHttpRuntime(),
          extractions: [{ name, source: 'json', path: '' }],
        }),
      ).toBe(false)
    },
  )

  it.each([
    ['contains', 200, false],
    ['contains', 'text', true],
    ['gt', '200', false],
    ['gte', 200, true],
    ['lt', Infinity, false],
    ['eq', null, true],
    ['neq', false, true],
    ['eq', undefined, false],
    ['exists', undefined, true],
    ['eq', {}, false],
    ['eq', [], false],
    ['in', [200, '201', null, true], true],
    ['notIn', [], true],
    ['in', 200, false],
    ['in', [{}], false],
    ['in', Array.from({ length: 1001 }, () => 1), false],
    ['between', [200, 299], true],
    ['between', [200, 200], true],
    ['between', [299, 200], false],
    ['between', [200, '299'], false],
    ['between', [200], false],
    ['between', [200, 299, 300], false],
    ['length', 0, true],
    ['length', -1, false],
    ['length', 1.5, false],
    ['length', '3', false],
    ['matches', '^hello.*$', true],
    ['notMatches', '[', false],
    ['matches', 'x'.repeat(1025), false],
    ['matches', 200, false],
    ['startsWith', 'hello', true],
    ['endsWith', false, false],
    ['notContains', 'x', true],
    ['isString', undefined, true],
    ['isNumber', undefined, true],
    ['isBoolean', undefined, true],
    ['isArray', undefined, true],
    ['isObject', undefined, true],
    ['isNull', undefined, true],
  ])('validates %s with %s', (operator, expected, valid) => {
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        assertions: [{ name: 'check', source: 'status', operator, expected }],
      }),
    ).toBe(valid)
  })

  it('requires a header path but allows an omitted JSON root', () => {
    const assertion = { name: 'check', source: 'header', operator: 'exists' }
    expect(
      isHttpRuntime({ ...emptyHttpRuntime(), assertions: [assertion] }),
    ).toBe(false)
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        assertions: [{ ...assertion, source: 'json' }],
      }),
    ).toBe(true)
  })

  it('rejects unsupported versions and over-limit collections', () => {
    expect(isHttpRuntime({ ...emptyHttpRuntime(), version: 3 })).toBe(false)
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        extractions: Array.from({ length: 101 }, (_, index) => ({
          name: `v${index}`,
          source: 'json',
          path: '',
        })),
      }),
    ).toBe(false)
  })
})

describe('script runtime versioning', () => {
  it('requires version 2 for scripts so older clients fail closed', () => {
    const scripts = { preRequest: 'mc.assert(true)', postResponse: '' }
    expect(isHttpRuntime({ ...emptyHttpRuntime(), scripts })).toBe(false)
    expect(isHttpRuntime({ ...emptyHttpRuntime(), version: 2, scripts })).toBe(
      true,
    )
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        version: 2,
        scripts: { ...scripts, preRequest: 'x'.repeat(65537) },
      }),
    ).toBe(false)
  })
})
