let generation = 0
let context: { vaultPath: string, environmentId: number | null } | null = null
const values = new Map<string, string>()
let running = false

export function resetHttpSession(): void {
  generation += 1
  values.clear()
  context = null
}

export function getHttpSession(
  vaultPath: string,
  environmentId: number | null,
) {
  if (
    !context
    || context.vaultPath !== vaultPath
    || context.environmentId !== environmentId
  ) {
    resetHttpSession()
    context = { vaultPath, environmentId }
  }
  return {
    generation,
    variables: Object.fromEntries(values),
    names: [...values.keys()],
  }
}

export function isHttpSessionCurrent(token: number): boolean {
  return generation === token
}

export function commitHttpSession(
  token: number,
  next: Map<string, string | null>,
): void {
  if (!isHttpSessionCurrent(token))
    return
  for (const [key, value] of next) {
    if (value === null)
      values.delete(key)
    else values.set(key, value)
  }
}

export function beginHttpExecution(): boolean {
  if (running)
    return false
  running = true
  return true
}

export function finishHttpExecution(): void {
  running = false
}
