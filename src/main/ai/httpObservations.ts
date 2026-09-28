// Bounded observations, not a generated contract or automatically selected tests.
export function httpObservations(snapshot: string) {
  let record: Record<string, unknown>
  try {
    record = JSON.parse(snapshot)
  }
  catch {
    return undefined
  }
  if (!record || typeof record !== 'object' || !('body' in record))
    return undefined
  let body: unknown = record.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    }
    catch {
      return { bodyFormat: 'not_parseable_as_json' }
    }
  }
  const fields: { path: string, type: string }[] = []
  let complete = true
  function visit(value: unknown, path: string, depth: number) {
    if (fields.length >= 64 || depth > 6 || path.length > 512) {
      complete = false
      return
    }
    const type
      = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
    fields.push({ path, type })
    // Array indices from one sample do not define minimum length requirements.
    if (type !== 'object')
      return
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (fields.length >= 64) {
        complete = false
        break
      }
      visit(
        child,
        `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`,
        depth + 1,
      )
    }
  }
  visit(body, '', 0)
  return {
    bodyFormat: 'json',
    fields,
    complete,
    meaning:
      'Observed JSON Pointer paths and types in this captured body only. Not an API contract or expected business values. No array elements are expanded.',
  }
}
