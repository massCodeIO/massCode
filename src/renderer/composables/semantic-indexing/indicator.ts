import type { AiSemanticProgress } from '~/shared/aiSemantic'

export type SemanticIndicatorPhase =
  | 'hidden'
  | 'downloading'
  | 'indexing'
  | 'error'

type Translate = (key: string, options?: Record<string, unknown>) => string

// Короткие досинхронизации на пару записей не должны мигать в рейке.
export const SEMANTIC_INDICATOR_DELAY_MS = 1000

export function semanticIndicatorPhase(
  status: AiSemanticProgress,
): SemanticIndicatorPhase {
  if (status.source === 'off')
    return 'hidden'
  if (status.builtin.state === 'downloading')
    return 'downloading'
  if (status.builtin.state === 'error')
    return 'error'
  if (status.index.state === 'error')
    return 'error'
  if (status.index.state === 'indexing')
    return 'indexing'
  return 'hidden'
}

function isBusyPhase(phase: SemanticIndicatorPhase) {
  return phase === 'downloading' || phase === 'indexing'
}

// Переход загрузки модели в индексацию не перезапускает задержку появления.
export function nextBusySince(
  phase: SemanticIndicatorPhase,
  busySince: number | undefined,
  now: number,
) {
  return isBusyPhase(phase) ? (busySince ?? now) : undefined
}

export function isSemanticIndicatorVisible(
  phase: SemanticIndicatorPhase,
  busySince: number | undefined,
  now: number,
) {
  if (phase === 'error')
    return true
  return (
    isBusyPhase(phase)
    && busySince !== undefined
    && now - busySince >= SEMANTIC_INDICATOR_DELAY_MS
  )
}

export function semanticIndicatorPercent(
  status: AiSemanticProgress,
  phase: SemanticIndicatorPhase,
) {
  if (phase === 'downloading')
    return status.builtin.progress
  if (phase === 'indexing' && status.index.total)
    return Math.round(((status.index.done ?? 0) / status.index.total) * 100)
  return undefined
}

export function semanticIndicatorTooltip(
  status: AiSemanticProgress,
  phase: SemanticIndicatorPhase,
  t: Translate,
  isWindows: boolean,
) {
  if (phase === 'downloading') {
    return [
      t('ai.semantic.rail.downloading', {
        percent: status.builtin.progress ?? 0,
      }),
      t('ai.semantic.rail.wordsReady'),
    ].join('\n')
  }
  if (phase === 'indexing') {
    const { done, total } = status.index
    return [
      total
        ? t('ai.semantic.rail.indexing', { done: done ?? 0, total })
        : t('ai.semantic.rail.preparing'),
      t('ai.semantic.rail.wordsReady'),
    ].join('\n')
  }
  if (phase === 'error') {
    const builtinError
      = status.builtin.state === 'error'
        ? (status.builtin.error ?? 'download')
        : undefined
    const error = builtinError
      ? t(
          `ai.semantic.builtin.errors.${builtinError === 'runtime' && isWindows ? 'runtimeWindows' : builtinError}`,
        )
      : t(`ai.errors.${status.index.error ?? 'connection'}`)
    return [error, t('ai.semantic.rail.openSettings')].join('\n')
  }
  return ''
}
