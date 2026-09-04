export interface HttpRuntime {
  version: 1
  extractions: { name: string, source: 'json' | 'header', path: string }[]
  assertions: {
    name: string
    source: 'status' | 'json' | 'header' | 'durationMs'
    path?: string
    operator:
      | 'eq'
      | 'neq'
      | 'exists'
      | 'contains'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
    expected?: string | number | boolean | null
  }[]
}

export type HttpRuntimeState = 'ready' | 'pending' | 'invalid' | 'unsupported'
export interface HttpRuntimeRead {
  runtimeRevision: string | null
  runtime: HttpRuntime | null
  runtimeState: HttpRuntimeState
}

export interface HttpRuntimeResult {
  index: number
  name: string
  ok: boolean
  errorCode?: 'missing' | 'invalidJson' | 'unavailableBody' | 'mismatch'
}

export function emptyHttpRuntime(): HttpRuntime {
  return { version: 1, extractions: [], assertions: [] }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validPointer(value: unknown): value is string {
  return (
    typeof value === 'string'
    && (value === '' || (value.startsWith('/') && !/~(?![01])/u.test(value)))
  )
}

export function isHttpRuntime(value: unknown): value is HttpRuntime {
  if (
    !record(value)
    || value.version !== 1
    || !Array.isArray(value.extractions)
    || !Array.isArray(value.assertions)
  ) {
    return false
  }
  if (value.extractions.length > 100 || value.assertions.length > 100)
    return false
  const validName = (name: unknown) =>
    typeof name === 'string' && name.trim().length > 0 && name.length <= 256
  const validSource = (rule: Record<string, unknown>) =>
    rule.source === 'json'
      ? validPointer(rule.path ?? '')
      : rule.source === 'header'
        && typeof rule.path === 'string'
        && rule.path.trim().length > 0
  const names = new Set<string>()
  for (const rule of value.extractions) {
    if (
      !record(rule)
      || !validName(rule.name)
      || !/^[\w.-]+$/u.test(rule.name as string)
      || rule.name === '__proto__'
      || typeof rule.path !== 'string'
      || !validSource(rule)
      || names.has(rule.name as string)
    ) {
      return false
    }
    names.add(rule.name as string)
  }
  return value.assertions.every((rule) => {
    if (
      !record(rule)
      || !validName(rule.name)
      || !(
        validSource(rule)
        || rule.source === 'status'
        || rule.source === 'durationMs'
      )
    ) {
      return false
    }
    if (
      !['eq', 'neq', 'exists', 'contains', 'gt', 'gte', 'lt', 'lte'].includes(
        rule.operator as string,
      )
    ) {
      return false
    }
    if (rule.operator === 'exists')
      return true
    if (rule.operator === 'contains')
      return typeof rule.expected === 'string'
    if (['gt', 'gte', 'lt', 'lte'].includes(rule.operator as string)) {
      return (
        typeof rule.expected === 'number' && Number.isFinite(rule.expected)
      )
    }
    return (
      rule.expected === null
      || typeof rule.expected === 'string'
      || typeof rule.expected === 'boolean'
      || (typeof rule.expected === 'number' && Number.isFinite(rule.expected))
    )
  })
}
