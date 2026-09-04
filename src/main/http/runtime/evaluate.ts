import type {
  HttpRuntime,
  HttpRuntimeResult,
} from '../../../shared/httpRuntime'
import type { HttpExecuteResult } from '../../types/http'

const missing = Symbol('missing')

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
  const extractions = runtime.extractions.map(
    (rule, index): HttpRuntimeResult => {
      const value = read(rule.source, rule.path)
      const ok = value !== missing && value !== null
      values.set(
        rule.name,
        ok
          ? typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)
          : null,
      )
      return {
        index,
        name: rule.name,
        ok,
        ...(!ok
          ? {
              errorCode:
                rule.source === 'json' && jsonError ? jsonError : 'missing',
            }
          : {}),
      }
    },
  )
  const assertions = runtime.assertions.map(
    (rule, index): HttpRuntimeResult => {
      const value = read(rule.source, rule.path)
      let ok = false
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
            ok
              = typeof value === 'string'
                && typeof rule.expected === 'string'
                && value.includes(rule.expected)
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
                value === missing
                  ? rule.source === 'json' && jsonError
                    ? jsonError
                    : 'missing'
                  : 'mismatch',
            }
          : {}),
      }
    },
  )
  return { values, results: { extractions, assertions } }
}
