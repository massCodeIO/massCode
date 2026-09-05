import type { HttpRuntime } from '../../../../shared/httpRuntime'
import type { HttpImportWarning } from '../types'
import type { ImportedScript, ScriptDialect } from './scripts'
import { httpRuntimeSchema } from '../../../../shared/httpRuntime'
import { addWarning } from '../normalize'
import { translateScript } from './scripts'

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function runtimeWarning(
  warnings: HttpImportWarning[],
  source: string,
  code: string,
) {
  addWarning(warnings, source, `spaces.http.import.runtimeWarnings.${code}`)
}

export function postmanScripts(
  value: unknown,
  source: string,
  warnings: HttpImportWarning[],
): ImportedScript[] {
  if (value === undefined)
    return []
  if (!Array.isArray(value))
    return [{ source, phase: 'preRequest', code: '', invalid: true }]
  return value
    .map((event, index): ImportedScript | null => {
      const entry = record(event)
      const location = `${source} [${index + 1}]`
      if (entry.disabled === true) {
        runtimeWarning(warnings, location, 'disabled')
        return null
      }
      const script = record(entry.script)
      const code
        = typeof script.exec === 'string'
          ? script.exec
          : Array.isArray(script.exec)
            && script.exec.every(line => typeof line === 'string')
            ? script.exec.join('\n')
            : null
      return {
        source: location,
        phase: entry.listen === 'test' ? 'postResponse' : 'preRequest',
        code: code ?? '',
        invalid:
          code === null
          || !['test', 'prerequest'].includes(String(entry.listen))
          || (script.type !== undefined && script.type !== 'text/javascript')
          || script.src !== undefined,
      }
    })
    .filter((script): script is ImportedScript => script !== null)
}

export interface BrunoScope {
  source: string
  raw: unknown
}

export function brunoScripts(
  scopes: BrunoScope[],
  sequential: boolean,
): ImportedScript[] {
  const groups = scopes.map(({ source, raw }) => {
    const data = record(raw)
    const scripts = data.scripts
    const result = {
      pre: [] as ImportedScript[],
      post: [] as ImportedScript[],
      tests: [] as ImportedScript[],
    }
    if (
      raw !== undefined
      && (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    ) {
      result.pre.push({ source, code: '', phase: 'preRequest', invalid: true })
      return result
    }
    if (scripts === undefined)
      return result
    if (!Array.isArray(scripts)) {
      result.pre.push({ source, code: '', phase: 'preRequest', invalid: true })
      return result
    }
    const types = new Set<string>()
    scripts.forEach((value, index) => {
      const script = record(value)
      const type = String(script.type)
      const phase = type === 'before-request' ? 'preRequest' : 'postResponse'
      const imported: ImportedScript = {
        source: `${source} [${index + 1}]`,
        phase,
        code: typeof script.code === 'string' ? script.code : '',
        invalid:
          typeof script.code !== 'string'
          || !['before-request', 'after-response', 'tests'].includes(type)
          || types.has(type),
      }
      types.add(type)
      if (type === 'before-request')
        result.pre.push(imported)
      else if (type === 'tests')
        result.tests.push(imported)
      else result.post.push(imported)
    })
    return result
  })
  // Bruno tests are a separate stage after all after-response scripts.
  return [
    ...groups.flatMap(group => group.pre),
    ...(sequential ? groups : [...groups].reverse()).flatMap(
      group => group.post,
    ),
    ...(sequential ? groups : [...groups].reverse()).flatMap(
      group => group.tests,
    ),
  ]
}

export function buildImportedRuntime(
  scripts: ImportedScript[],
  dialect: ScriptDialect,
  source: string,
  warnings: HttpImportWarning[],
  assertions: HttpRuntime['assertions'] = [],
): { runtime?: HttpRuntime, scriptStatus: 'none' | 'converted' | 'blocked' } {
  const active = scripts.filter(
    script => script.invalid || script.code.trim(),
  )
  if (!active.length && !assertions.length)
    return { scriptStatus: 'none' }
  const exceedsLimit
    = active.length > 100
      || active.reduce(
        (size, script) => size + script.code.length + script.source.length,
        0,
      ) > 64_000
  let blocked = exceedsLimit
  let usesVariables = false
  const translated = active.map((script) => {
    if (exceedsLimit)
      return ''
    try {
      if (script.invalid)
        throw new Error('invalid')
      const result = translateScript(script.code, dialect, script.phase)
      usesVariables ||= result.usesVariables
      return result.code
    }
    catch {
      blocked = true
      runtimeWarning(warnings, script.source, 'unsupportedScript')
      return ''
    }
  })
  if (usesVariables)
    runtimeWarning(warnings, source, 'variables')
  const code = { preRequest: '', postResponse: '' }
  for (const phase of ['preRequest', 'postResponse'] as const) {
    code[phase] = active
      .flatMap((script, index) =>
        script.phase === phase ? [translated[index]] : [],
      )
      .join('\n')
    if (code[phase].length > 65536) {
      blocked = true
      runtimeWarning(warnings, source, 'sourceLimit')
    }
  }
  if (blocked) {
    // One unsupported ancestor can affect every later script. Block both phases.
    // JSON encoded single-line comments cannot escape through */ or newlines.
    const originals = exceedsLimit
      ? ''
      : active
          .map(
            script =>
              `// ${JSON.stringify({ source: script.source, code: script.code }).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')}`,
          )
          .join('\n')
    if (exceedsLimit || originals.length > 64000) {
      runtimeWarning(warnings, source, 'sourceLimit')
      code.preRequest
        = 'mc.assert(false); // IMPORT_REQUIRES_ADAPTATION: original source exceeds storage limit'
    }
    else {
      code.preRequest = `mc.assert(false); // IMPORT_REQUIRES_ADAPTATION\n${originals}`
    }
    code.postResponse = ''
  }
  const runtime = httpRuntimeSchema.parse({
    version: 2,
    assertions,
    extractions: [],
    ...(active.length ? { scripts: code } : {}),
  })
  return {
    runtime,
    scriptStatus: active.length ? (blocked ? 'blocked' : 'converted') : 'none',
  }
}
