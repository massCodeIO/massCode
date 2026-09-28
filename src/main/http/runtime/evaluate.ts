import type {
  HttpRuntime,
  HttpRuntimeResult,
} from '../../../shared/httpRuntime'
import type { HttpExecuteResult } from '../../types/http'
import { Script } from 'node:vm'
import { serializeVariable, variableScopeLimit } from './variables'

const missing = Symbol('missing')
// Only this fixed expression executes; patterns and values are data, never code.
const regexScript = new Script('new RegExp(pattern, "u").test(value)')

export function readJsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === '')
    return value
  if (!pointer.startsWith('/') || /~(?![01])/u.test(pointer))
    return missing
  for (const token of pointer.slice(1).split('/')) {
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(value) && !/^(?:0|[1-9]\d*)$/u.test(key))
      return missing
    if (
      value === null
      || typeof value !== 'object'
      || !Object.hasOwn(value, key)
    ) {
      return missing
    }
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

export function evaluateHttpRuntime(
  runtime: HttpRuntime,
  response: HttpExecuteResult,
  previous: Map<string, string | null> = new Map(),
) {
  const values = new Map<string, string | null>()
  let json: unknown = missing
  let jsonError: HttpRuntimeResult['errorCode']
  if (
    response.truncated
    || response.bodyKind === 'binary'
    || response.status === null
  ) {
    jsonError = 'unavailableBody'
  }
  else {
    try {
      json = JSON.parse(response.body)
    }
    catch {
      jsonError = 'invalidJson'
    }
  }
  function read(source: string, path = ''): unknown {
    if (source === 'status')
      return response.status ?? missing
    if (source === 'durationMs')
      return response.durationMs
    if (source === 'header') {
      return (
        response.headers.find(
          header => header.key.toLowerCase() === path.toLowerCase(),
        )?.value ?? missing
      )
    }
    return json === missing ? missing : readJsonPointer(json, path)
  }
  const candidate = new Map(previous)
  const serialized = new Map<unknown, string | undefined>()
  let limit: 'valueLimit' | 'scopeLimit' | undefined
  const extractions = runtime.extractions.map(
    (rule, index): HttpRuntimeResult => {
      const value = read(rule.source, rule.path)
      let ok = value !== missing && value !== null
      if (!limit) {
        if (ok && !serialized.has(value))
          serialized.set(value, serializeVariable(value))
        const text = ok ? serialized.get(value) : null
        if (text === undefined) {
          limit = 'valueLimit'
        }
        else {
          candidate.set(rule.name, text)
          limit = variableScopeLimit(candidate)
          if (!limit)
            values.set(rule.name, text)
        }
      }
      ok &&= !limit
      return {
        index,
        name: rule.name,
        ok,
        ...(!ok
          ? {
              errorCode:
                limit
                ?? (rule.source === 'json' && jsonError ? jsonError : 'missing'),
            }
          : {}),
      }
    },
  )
  if (limit) {
    values.clear()
    for (const result of extractions) {
      result.ok = false
      result.errorCode = limit
    }
  }
  let regexBudgetMs = 100
  const assertions = runtime.assertions.map(
    (rule, index): HttpRuntimeResult => {
      const value = read(rule.source, rule.path)
      let ok = false
      let errorCode: HttpRuntimeResult['errorCode']
      if (value !== missing) {
        switch (rule.operator) {
          case 'exists':
            ok = true
            break
          case 'eq':
            ok = value === rule.expected
            break
          case 'neq':
            ok = value !== rule.expected
            break
          case 'contains':
          case 'notContains':
          case 'startsWith':
          case 'endsWith':
            ok
              = typeof value === 'string'
                && typeof rule.expected === 'string'
                && (rule.operator === 'startsWith'
                  ? value.startsWith(rule.expected)
                  : rule.operator === 'endsWith'
                    ? value.endsWith(rule.expected)
                    : rule.operator === 'notContains'
                      ? !value.includes(rule.expected)
                      : value.includes(rule.expected))
            break
          case 'matches':
          case 'notMatches':
            if (
              typeof value === 'string'
              && typeof rule.expected === 'string'
            ) {
              const started = performance.now()
              try {
                if (
                  value.length > 1_000_000
                  || rule.expected.length > 1024
                  || regexBudgetMs < 1
                ) {
                  throw new Error('regex budget exceeded')
                }
                const matches
                  = regexScript.runInNewContext(
                    { pattern: rule.expected, value },
                    {
                      timeout: Math.min(20, Math.floor(regexBudgetMs)),
                      contextCodeGeneration: { strings: false, wasm: false },
                    },
                  ) === true
                ok = rule.operator === 'matches' ? matches : !matches
              }
              catch {
                errorCode = 'regexLimit'
              }
              finally {
                regexBudgetMs -= performance.now() - started
              }
            }
            break
          case 'length':
            ok
              = (typeof value === 'string' || Array.isArray(value))
                && value.length === rule.expected
            break
          case 'between':
            ok
              = typeof value === 'number'
                && Array.isArray(rule.expected)
                && typeof rule.expected[0] === 'number'
                && typeof rule.expected[1] === 'number'
                && value >= rule.expected[0]
                && value <= rule.expected[1]
            break
          case 'in':
          case 'notIn':
            if (
              (value === null
                || typeof value === 'string'
                || typeof value === 'number'
                || typeof value === 'boolean')
              && Array.isArray(rule.expected)
            ) {
              const included = rule.expected.includes(value)
              ok = rule.operator === 'in' ? included : !included
            }
            break
          case 'isString':
            ok = typeof value === 'string'
            break
          case 'isNumber':
            ok = typeof value === 'number' && Number.isFinite(value)
            break
          case 'isBoolean':
            ok = typeof value === 'boolean'
            break
          case 'isArray':
            ok = Array.isArray(value)
            break
          case 'isObject':
            ok
              = value !== null
                && typeof value === 'object'
                && !Array.isArray(value)
            break
          case 'isNull':
            ok = value === null
            break
          default:
            if (
              typeof value === 'number'
              && Number.isFinite(value)
              && typeof rule.expected === 'number'
            ) {
              if (rule.operator === 'gt')
                ok = value > rule.expected
              if (rule.operator === 'gte')
                ok = value >= rule.expected
              if (rule.operator === 'lt')
                ok = value < rule.expected
              if (rule.operator === 'lte')
                ok = value <= rule.expected
            }
        }
      }
      return {
        index,
        name: rule.name,
        ok,
        ...(!ok
          ? {
              errorCode:
                errorCode
                ?? (value === missing
                  ? rule.source === 'json' && jsonError
                    ? jsonError
                    : 'missing'
                  : 'mismatch'),
            }
          : {}),
      }
    },
  )
  return { values, limit, results: { extractions, assertions } }
}
