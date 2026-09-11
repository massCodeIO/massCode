import { z } from 'zod'
import { httpScriptsSchema } from './httpScripts'
import { httpTransportSchema } from './httpTransport'

const nameSchema = z
  .string()
  .refine(value => value.trim().length > 0, 'required')
  .refine(value => value.length <= 256, 'nameLength')
const pointerSchema = z
  .string()
  .refine(
    value =>
      value === '' || (value.startsWith('/') && !/~(?![01])/u.test(value)),
    'pointer',
  )
const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const httpExpectedSchema = z.union([
  scalarSchema,
  z.array(scalarSchema).max(1000),
])

export const httpAssertionOperators = [
  'eq',
  'neq',
  'exists',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'matches',
  'notMatches',
  'length',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
  'notIn',
  'isString',
  'isNumber',
  'isBoolean',
  'isArray',
  'isObject',
  'isNull',
] as const

export function httpOperatorNeedsExpected(operator: string) {
  return ![
    'exists',
    'isString',
    'isNumber',
    'isBoolean',
    'isArray',
    'isObject',
    'isNull',
  ].includes(operator)
}

function isValidRegex(pattern: string) {
  try {
    return pattern.length <= 1024 && Boolean(new RegExp(pattern, 'u'))
  }
  catch {
    return false
  }
}

const extractionSchema = z
  .object({
    name: nameSchema.refine(
      value => /^[\w.-]+$/u.test(value) && value !== '__proto__',
      'variableName',
    ),
    source: z.enum(['json', 'header']),
    path: z.string(),
  })
  .superRefine((rule, ctx) => {
    if (rule.source === 'json' && !pointerSchema.safeParse(rule.path).success)
      ctx.addIssue({ code: 'custom', path: ['path'], message: 'pointer' })
    if (rule.source === 'header' && !rule.path.trim())
      ctx.addIssue({ code: 'custom', path: ['path'], message: 'required' })
  })

const assertionSchema = z
  .object({
    name: nameSchema,
    source: z.enum(['status', 'json', 'header', 'durationMs']),
    path: z.string().optional(),
    operator: z.enum(httpAssertionOperators),
    expected: httpExpectedSchema.optional(),
  })
  .superRefine((rule, ctx) => {
    if (
      rule.source === 'json'
      && !pointerSchema.safeParse(rule.path ?? '').success
    ) {
      ctx.addIssue({ code: 'custom', path: ['path'], message: 'pointer' })
    }
    if (rule.source === 'header' && !rule.path?.trim())
      ctx.addIssue({ code: 'custom', path: ['path'], message: 'required' })
    if (!httpOperatorNeedsExpected(rule.operator))
      return
    if (
      [
        'contains',
        'notContains',
        'startsWith',
        'endsWith',
        'matches',
        'notMatches',
      ].includes(rule.operator)
      && typeof rule.expected !== 'string'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expected'],
        message: 'expectedString',
      })
    }
    else if (
      ['gt', 'gte', 'lt', 'lte'].includes(rule.operator)
      && typeof rule.expected !== 'number'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expected'],
        message: 'expectedNumber',
      })
    }
    else if (
      rule.operator === 'length'
      && !(
        typeof rule.expected === 'number'
        && Number.isSafeInteger(rule.expected)
        && rule.expected >= 0
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expected'],
        message: 'expectedLength',
      })
    }
    else if (
      rule.operator === 'between'
      && !(
        Array.isArray(rule.expected)
        && rule.expected.length === 2
        && typeof rule.expected[0] === 'number'
        && typeof rule.expected[1] === 'number'
        && rule.expected[0] <= rule.expected[1]
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expected'],
        message: 'expectedRange',
      })
    }
    else if (
      ['in', 'notIn'].includes(rule.operator)
      && !Array.isArray(rule.expected)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expected'],
        message: 'expectedList',
      })
    }
    else if (
      ['matches', 'notMatches'].includes(rule.operator)
      && typeof rule.expected === 'string'
    ) {
      if (!isValidRegex(rule.expected)) {
        ctx.addIssue({
          code: 'custom',
          path: ['expected'],
          message: 'expectedRegex',
        })
      }
    }
    else if (
      rule.expected === undefined
      || (['eq', 'neq'].includes(rule.operator) && Array.isArray(rule.expected))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expected'],
        message: 'expectedScalar',
      })
    }
  })

export const httpRuntimeSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    scripts: httpScriptsSchema.optional(),
    transport: httpTransportSchema.optional(),
    extractions: z.array(extractionSchema).max(100),
    assertions: z.array(assertionSchema).max(100),
  })
  .superRefine((runtime, ctx) => {
    if (runtime.scripts && runtime.version !== 2)
      ctx.addIssue({ code: 'custom', path: ['scripts'], message: 'version' })
    const names = new Map<string, number[]>()
    runtime.extractions.forEach((rule, index) => {
      const indices = names.get(rule.name) ?? []
      indices.push(index)
      names.set(rule.name, indices)
    })
    for (const indices of names.values()) {
      if (indices.length > 1) {
        for (const index of indices) {
          ctx.addIssue({
            code: 'custom',
            path: ['extractions', index, 'name'],
            message: 'duplicateName',
          })
        }
      }
    }
  })

export type HttpRuntime = z.infer<typeof httpRuntimeSchema>

export type HttpRuntimeState = 'ready' | 'pending' | 'invalid' | 'unsupported'
export interface HttpRuntimeRead {
  runtimeRevision: string | null
  runtime: HttpRuntime | null
  runtimeState: HttpRuntimeState
}

export interface HttpRuntimeResult {
  source?: 'request' | 'collection'
  index: number
  name: string
  ok: boolean
  errorCode?:
    | 'missing'
    | 'invalidJson'
    | 'unavailableBody'
    | 'mismatch'
    | 'regexLimit'
    | 'valueLimit'
    | 'scopeLimit'
}

export function emptyHttpRuntime(): HttpRuntime {
  return { version: 1, extractions: [], assertions: [] }
}

export function isHttpRuntime(value: unknown): value is HttpRuntime {
  return httpRuntimeSchema.safeParse(value).success
}
