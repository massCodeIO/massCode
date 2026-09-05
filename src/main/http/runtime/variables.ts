import { Buffer } from 'node:buffer'

export const HTTP_VARIABLE_VALUE_BYTES = 256 * 1024
export const HTTP_VARIABLE_SCOPE_BYTES = 2 * 1024 * 1024
export type VariableLimit = 'valueLimit' | 'scopeLimit'

export function variableScopeLimit(
  values: Map<string, string | null>,
): VariableLimit | undefined {
  let bytes = 0
  for (const [name, value] of values) {
    if (value === null)
      continue
    const size = Buffer.byteLength(value)
    if (size > HTTP_VARIABLE_VALUE_BYTES)
      return 'valueLimit'
    bytes += Buffer.byteLength(name) + size
    if (bytes > HTTP_VARIABLE_SCOPE_BYTES)
      return 'scopeLimit'
  }
}

// Stop traversing oversized JSON before allocating its complete serialization.
// The final check includes punctuation/escaping; the traversal is a lower bound.
export function serializeVariable(value: unknown): string | undefined {
  if (typeof value !== 'object') {
    const text = String(value)
    return Buffer.byteLength(text) <= HTTP_VARIABLE_VALUE_BYTES
      ? text
      : undefined
  }
  let bytes = 0
  try {
    const text = JSON.stringify(value, function (this: unknown, key, item) {
      // Array indices are visited by the replacer but absent from wire JSON.
      if (!Array.isArray(this))
        bytes += Buffer.byteLength(key)
      if (typeof item === 'string')
        bytes += Buffer.byteLength(item)
      else if (item === null || typeof item !== 'object')
        bytes += String(item).length
      // Every visited value contributes at least one serialized character.
      bytes += 1
      if (bytes > HTTP_VARIABLE_VALUE_BYTES)
        throw new RangeError('valueLimit')
      return item
    })
    return Buffer.byteLength(text) <= HTTP_VARIABLE_VALUE_BYTES
      ? text
      : undefined
  }
  catch {
    return undefined
  }
}
