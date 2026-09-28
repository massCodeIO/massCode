/** One suspended application action per sequential tool loop. */
export function createActionWait(signal: AbortSignal, budgetMs: number) {
  const deadline = new AbortController()
  let remaining = budgetMs
  let started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending:
    | {
      id: string
      resolve: (value: unknown) => void
      reject: (reason: unknown) => void
    }
    | undefined
  const resume = () => {
    started = Date.now()
    timer = setTimeout(() => deadline.abort(), Math.max(0, remaining))
  }
  const pause = () => {
    clearTimeout(timer)
    remaining -= Date.now() - started
  }
  const abort = () => {
    pending?.reject(signal.reason)
    pending = undefined
    clearTimeout(timer)
  }
  signal.addEventListener('abort', abort, { once: true })
  resume()
  return {
    signal: deadline.signal,
    wait(id: string) {
      signal.throwIfAborted()
      deadline.signal.throwIfAborted()
      if (pending)
        throw new Error('ACTION_ALREADY_PENDING')
      pause()
      return new Promise<unknown>((resolve, reject) => {
        pending = { id, resolve, reject }
      })
    },
    owns(id: string) {
      return pending?.id === id && !signal.aborted
    },
    settle(id: string, value: unknown) {
      if (pending?.id !== id || signal.aborted)
        return
      const waiting = pending
      pending = undefined
      resume()
      waiting.resolve(value)
    },
    dispose() {
      signal.removeEventListener('abort', abort)
      abort()
    },
  }
}
