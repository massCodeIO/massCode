import type { HttpRuntime } from '../../../../shared/httpRuntime'
import type { HttpExecuteResult } from '../../../types/http'
import { describe, expect, it } from 'vitest'
import {
  emptyHttpRuntime,
  isHttpRuntime,
} from '../../../../shared/httpRuntime'
import { evaluateHttpRuntime } from '../evaluate'
import {
  commitHttpSession,
  getHttpSession,
  isHttpSessionCurrent,
  resetHttpSession,
} from '../session'

const response: HttpExecuteResult = {
  status: 200,
  statusText: '',
  headers: [{ key: 'X-Token', value: 'secret' }],
  body: '{"a/b":{"~key":[null,42]},"token":"sensitive","text":"hello"}',
  bodyKind: 'json',
  durationMs: 15,
  sizeBytes: 0,
  truncated: false,
}

describe('hTTP declarative runtime', () => {
  it.each([
    ['matches', 'hello', '^h.*o$', true],
    ['matches', 'hello', '^no$', false],
    ['notMatches', 'hello', '^no$', true],
    ['notMatches', 200, '^no$', false],
    ['notContains', 'hello', 'x', true],
    ['notContains', 'hello', 'ell', false],
    ['startsWith', 'hello', 'he', true],
    ['endsWith', 'hello', 'lo', true],
    ['startsWith', 'hello', 'ell', false],
    ['length', 'hello', 5, true],
    ['length', [1, 2], 2, true],
    ['length', '', 0, true],
    ['length', { length: 2 }, 2, false],
    ['between', 200, [200, 299], true],
    ['between', 299, [200, 299], true],
    ['between', 300, [200, 299], false],
    ['between', '200', [200, 299], false],
    ['in', 200, [200, 201], true],
    ['in', '200', [200, 201], false],
    ['in', null, [null], true],
    ['notIn', 500, [200, 201], true],
    ['notIn', 200, [200, 201], false],
    ['notIn', {}, [], false],
    ['isString', '200', undefined, true],
    ['isString', 200, undefined, false],
    ['isNumber', 200, undefined, true],
    ['isNumber', '200', undefined, false],
    ['isBoolean', false, undefined, true],
    ['isBoolean', 0, undefined, false],
    ['isArray', [], undefined, true],
    ['isArray', {}, undefined, false],
    ['isObject', {}, undefined, true],
    ['isObject', [], undefined, false],
    ['isObject', null, undefined, false],
    ['isNull', null, undefined, true],
    ['isNull', false, undefined, false],
  ] satisfies [
    HttpRuntime['assertions'][number]['operator'],
    unknown,
    HttpRuntime['assertions'][number]['expected'],
    boolean,
  ][])('evaluates %s for %j against %j', (operator, value, expected, ok) => {
    const runtime: HttpRuntime = {
      ...emptyHttpRuntime(),
      assertions: [{ name: 'check', source: 'json', operator, expected }],
    }
    expect(
      evaluateHttpRuntime(runtime, { ...response, body: JSON.stringify(value) })
        .results
        .assertions[0]
        ?.ok,
    ).toBe(ok)
  })

  it.each(['notMatches', 'notIn', 'isNull'] as const)(
    'does not pass %s for missing data',
    (operator) => {
      const runtime: HttpRuntime = {
        ...emptyHttpRuntime(),
        assertions: [
          {
            name: 'missing',
            source: 'json',
            path: '/missing',
            operator,
            expected: operator === 'notIn' ? [] : 'x',
          },
        ],
      }
      expect(
        evaluateHttpRuntime(runtime, response).results.assertions[0],
      ).toMatchObject({ ok: false, errorCode: 'missing' })
      expect(
        evaluateHttpRuntime(runtime, { ...response, body: '{' }).results
          .assertions[0],
      ).toMatchObject({ ok: false, errorCode: 'invalidJson' })
    },
  )

  it('bounds pathological regex and never turns execution failure into a negative-match pass', () => {
    const runtime: HttpRuntime = {
      ...emptyHttpRuntime(),
      assertions: [
        {
          name: 'regex',
          source: 'json',
          operator: 'notMatches',
          expected: '^(a+)+$',
        },
      ],
    }
    const started = performance.now()
    expect(
      evaluateHttpRuntime(runtime, {
        ...response,
        body: JSON.stringify(`${'a'.repeat(10000)}!`),
      }).results.assertions[0],
    ).toMatchObject({ ok: false, errorCode: 'regexLimit' })
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('reads JSON Pointer own properties and distinguishes missing from null', () => {
    const runtime: HttpRuntime = {
      ...emptyHttpRuntime(),
      assertions: [
        {
          name: 'null exists',
          source: 'json',
          path: '/a~1b/~0key/0',
          operator: 'exists',
        },
        {
          name: 'array',
          source: 'json',
          path: '/a~1b/~0key/1',
          operator: 'eq',
          expected: 42,
        },
        {
          name: 'inherited',
          source: 'json',
          path: '/toString',
          operator: 'exists',
        },
        {
          name: 'missing',
          source: 'json',
          path: '/missing',
          operator: 'neq',
          expected: null,
        },
        {
          name: 'array length is not JSON data',
          source: 'json',
          path: '/a~1b/~0key/length',
          operator: 'exists',
        },
      ],
    }
    expect(
      evaluateHttpRuntime(runtime, response).results.assertions.map(
        item => item.ok,
      ),
    ).toEqual([true, true, false, false, false])
  })

  it('compares without coercion and supports ordered numbers and substring', () => {
    const runtime: HttpRuntime = {
      ...emptyHttpRuntime(),
      assertions: [
        {
          name: 'type mismatch',
          source: 'status',
          operator: 'eq',
          expected: '200',
        },
        {
          name: 'duration',
          source: 'durationMs',
          operator: 'lte',
          expected: 15,
        },
        {
          name: 'text',
          source: 'json',
          path: '/text',
          operator: 'contains',
          expected: 'ell',
        },
        {
          name: 'not numeric',
          source: 'header',
          path: 'x-token',
          operator: 'gt',
          expected: 0,
        },
      ],
    }
    expect(
      evaluateHttpRuntime(runtime, response).results.assertions.map(
        item => item.ok,
      ),
    ).toEqual([false, true, true, false])
  })

  it('extracts root objects, scalars and case insensitive headers without leaking values into results', () => {
    const runtime: HttpRuntime = {
      ...emptyHttpRuntime(),
      extractions: [
        { name: 'root', source: 'json', path: '' },
        { name: 'token', source: 'json', path: '/token' },
        { name: 'header', source: 'header', path: 'x-token' },
        { name: 'null', source: 'json', path: '/a~1b/~0key/0' },
      ],
    }
    const evaluated = evaluateHttpRuntime(runtime, response)
    expect(evaluated.values.get('token')).toBe('sensitive')
    expect(evaluated.values.get('header')).toBe('secret')
    expect(evaluated.values.get('null')).toBeNull()
    expect(JSON.parse(evaluated.values.get('root')!)).toEqual(
      JSON.parse(response.body),
    )
    expect(JSON.stringify(evaluated.results)).not.toMatch(/sensitive|secret/)
  })

  it.each([
    { truncated: true },
    { bodyKind: 'binary' as const },
    { body: '{' },
  ])('does not parse unsafe response body %j', (override) => {
    const runtime: HttpRuntime = {
      ...emptyHttpRuntime(),
      extractions: [{ name: 'token', source: 'json', path: '/token' }],
    }
    expect(
      evaluateHttpRuntime(runtime, { ...response, ...override }).values.get(
        'token',
      ),
    ).toBeNull()
  })

  it('validates shape, pointers, names, limits and expected types', () => {
    expect(isHttpRuntime(emptyHttpRuntime())).toBe(true)
    expect(isHttpRuntime({ ...emptyHttpRuntime(), version: 2 })).toBe(false)
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        extractions: [{ name: '__proto__', source: 'json', path: '' }],
      }),
    ).toBe(false)
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        extractions: [{ name: 'a', source: 'json', path: '/~3' }],
      }),
    ).toBe(false)
    expect(
      isHttpRuntime({
        ...emptyHttpRuntime(),
        assertions: [
          { name: 'a', source: 'status', operator: 'gt', expected: '200' },
        ],
      }),
    ).toBe(false)
  })

  it('isolates session contexts, rejects stale commits and deletes failed extraction names', () => {
    resetHttpSession()
    const first = getHttpSession('/vault', 1)
    commitHttpSession(first.generation, new Map([['token', 'secret']]))
    expect(getHttpSession('/vault', 1).variables.token).toBe('secret')
    commitHttpSession(first.generation, new Map([['token', null]]))
    expect(getHttpSession('/vault', 1).names).toEqual([])
    getHttpSession('/vault', 2)
    expect(isHttpSessionCurrent(first.generation)).toBe(false)
    commitHttpSession(first.generation, new Map([['token', 'stale']]))
    expect(getHttpSession('/other-vault', 2).names).toEqual([])
  })
})
