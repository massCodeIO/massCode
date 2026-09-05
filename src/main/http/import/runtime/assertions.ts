import type { AnyNode } from 'acorn'
import type { HttpRuntime } from '../../../../shared/httpRuntime'
import type { HttpImportWarning } from '../types'
import { parseExpressionAt } from 'acorn'
import {
  httpOperatorNeedsExpected,
  httpRuntimeSchema,
} from '../../../../shared/httpRuntime'
import { record, runtimeWarning } from './index'

function sourcePath(expression: string) {
  if (expression.length > 1024)
    throw new Error('limit')
  let node: AnyNode = parseExpressionAt(expression, 0, { ecmaVersion: 2022 })
  if (expression.slice(node.end).trim())
    throw new Error('expression')
  const path: string[] = []
  while (node.type === 'MemberExpression' && !node.optional) {
    const key
      = !node.computed && node.property.type === 'Identifier'
        ? node.property.name
        : node.computed
          && node.property.type === 'Literal'
          && ['string', 'number'].includes(typeof node.property.value)
          ? String(node.property.value)
          : null
    if (key === null || ['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error('path')
    path.unshift(key)
    node = node.object
  }
  if (node.type !== 'Identifier' || node.name !== 'res')
    throw new Error('source')
  if (path.length === 1 && path[0] === 'status')
    return { source: 'status' as const }
  if (path.length === 1 && path[0] === 'responseTime')
    return { source: 'durationMs' as const }
  if (path[0] === 'body') {
    return {
      source: 'json' as const,
      path: path
        .slice(1)
        .map(key => `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`)
        .join(''),
    }
  }
  if (path[0] === 'headers' && path.length === 2)
    return { source: 'header' as const, path: path[1] }
  throw new Error('source')
}

function literal(value: unknown): string | number | boolean | null {
  if (
    typeof value !== 'string'
    || value.length > 1024
    || /\{\{|\$\{|`|\\/u.test(value)
  ) {
    throw new Error('value')
  }
  const text = value.trim()
  // Bruno strips surrounding quotes without JS unescaping, then handles scalars.
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith('\'') && text.endsWith('\''))
  ) {
    return text.slice(1, -1)
  }
  if (text === 'true' || text === 'false')
    return text === 'true'
  if (text === 'null')
    return null
  if (
    text
    && Number.isFinite(Number(text))
    && Number(text) <= Number.MAX_SAFE_INTEGER
  ) {
    return Number(text)
  }
  if (text === 'undefined')
    throw new Error('undefined')
  return text
}

export function brunoAssertions(
  value: unknown,
  source: string,
  warnings: HttpImportWarning[],
): HttpRuntime['assertions'] {
  if (value === undefined)
    return []
  if (!Array.isArray(value)) {
    runtimeWarning(warnings, source, 'unsupportedAssertion')
    return []
  }
  const assertions: HttpRuntime['assertions'] = []
  value.forEach((raw, index) => {
    const entry = record(raw)
    const location = `${source} [${index + 1}]`
    if (entry.disabled === true) {
      runtimeWarning(warnings, location, 'disabled')
      return
    }
    try {
      if (
        assertions.length >= 100
        || typeof entry.expression !== 'string'
        || typeof entry.operator !== 'string'
      ) {
        throw new Error('invalid')
      }
      // Regex, containment and list operators have different type/coercion semantics.
      if (
        ![
          'eq',
          'neq',
          'gt',
          'gte',
          'lt',
          'lte',
          'isString',
          'isNumber',
          'isBoolean',
          'isArray',
          'isNull',
        ].includes(entry.operator)
      ) {
        throw new Error('operator')
      }
      const selectedSource = sourcePath(entry.expression)
      if (
        entry.operator === 'neq'
        && ['json', 'header'].includes(selectedSource.source)
      ) {
        throw new Error('missing-value-semantics')
      }
      const assertion = {
        name: entry.expression.slice(0, 256),
        ...selectedSource,
        operator: entry.operator,
        ...(httpOperatorNeedsExpected(entry.operator)
          ? { expected: literal(entry.value) }
          : {}),
      }
      const runtime = httpRuntimeSchema.parse({
        version: 1,
        extractions: [],
        assertions: [assertion],
      })
      assertions.push(runtime.assertions[0])
    }
    catch {
      runtimeWarning(warnings, location, 'unsupportedAssertion')
    }
  })
  return assertions
}
