function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function same(left: unknown, right: unknown): boolean {
  if (object(left) && object(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    return [...keys].every(key => same(left[key], right[key]))
  }
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Restore only touched leaves whose current value still matches our write. */
export function inverseAiPatch(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  current: Record<string, unknown>,
  prefix = '',
) {
  const patch: Record<string, unknown> = {}
  const remainingBefore: Record<string, unknown> = {}
  const remainingAfter: Record<string, unknown> = {}
  const conflicts: string[] = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[key], after[key]))
      continue
    const path = prefix ? `${prefix}.${key}` : key
    if (object(before[key]) && object(after[key]) && object(current[key])) {
      const child = inverseAiPatch(before[key], after[key], current[key], path)
      if (Object.keys(child.patch).length)
        patch[key] = child.patch
      if (child.conflicts.length) {
        remainingBefore[key] = child.remainingBefore
        remainingAfter[key] = child.remainingAfter
        conflicts.push(...child.conflicts)
      }
    }
    else if (same(current[key], after[key])) {
      patch[key]
        = before[key] === undefined
          ? undefined
          : JSON.parse(JSON.stringify(before[key]))
    }
    else {
      conflicts.push(path)
      remainingBefore[key] = before[key]
      remainingAfter[key] = after[key]
    }
  }
  return { patch, remainingBefore, remainingAfter, conflicts }
}

/** Merge an inverse into fresh state, preserving independent sibling fields. */
export function applyAiPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete result[key]
    }
    else {
      result[key] = object(value)
        ? applyAiPatch(object(current[key]) ? current[key] : {}, value)
        : JSON.parse(JSON.stringify(value))
    }
  }
  return result
}
