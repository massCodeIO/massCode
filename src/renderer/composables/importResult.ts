import type { AiDataAction, AiDataWarnings } from '~/shared/aiDataActions'

export type ImportReporter = (
  status: AiDataAction['status'],
  summary?: Record<string, number>,
  warnings?: AiDataWarnings,
) => void

// An in-flight Apply owns its receipt even after its dialog is closed/replaced.
export function createImportResultSession() {
  interface Opening {
    reporter?: ImportReporter
    valid: () => boolean
    applying: boolean
    closed: boolean
    terminal?: 'applied' | 'failed' | 'cancelled'
  }
  let current: Opening | undefined
  function close() {
    if (!current)
      return
    current.closed = true
    if (!current.applying && !current.terminal) {
      current.terminal = 'cancelled'
      current.reporter?.('cancelled')
    }
  }
  function canContinue() {
    if (
      !current
      || current.closed
      || current.applying
      || current.terminal === 'applied'
    ) {
      return false
    }
    if (current.valid())
      return true
    close()
    return false
  }
  return {
    open(reporter?: ImportReporter, valid = () => true) {
      close()
      current = { reporter, valid, applying: false, closed: false }
    },
    canContinue,
    capture() {
      const opening = current
      const isCurrent = () =>
        Boolean(opening && opening === current && !opening.closed)
      const report = (
        status: AiDataAction['status'],
        summary?: Record<string, number>,
        warnings?: AiDataWarnings,
      ) => {
        if (
          !opening
          || opening !== current
          || opening.closed
          || opening.applying
          || opening.terminal === 'applied'
        ) {
          return
        }
        opening.reporter?.(
          status,
          summary,
          ...(warnings ? ([warnings] as const) : []),
        )
      }
      return Object.assign(report, { isCurrent })
    },
    beginApply() {
      if (!canContinue())
        return undefined
      const opening = current!
      opening.applying = true
      opening.terminal = undefined
      let finished = false
      return {
        isCurrent: () => opening === current && !opening.closed,
        report(
          status: 'applied' | 'failed',
          summary?: Record<string, number>,
          warnings?: AiDataWarnings,
        ) {
          if (finished)
            return
          finished = true
          opening.applying = false
          opening.terminal = status
          opening.reporter?.(
            status,
            summary,
            ...(warnings ? ([warnings] as const) : []),
          )
        },
      }
    },
    close,
  }
}
export function importCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object')
    return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === 'number'),
  ) as Record<string, number>
}
