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
