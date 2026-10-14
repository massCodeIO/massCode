import type { AiSemanticProgress } from '~/shared/aiSemantic'
import { describe, expect, it } from 'vitest'
import {
  isSemanticIndicatorVisible,
  nextBusySince,
  SEMANTIC_INDICATOR_DELAY_MS,
  semanticIndicatorPercent,
  semanticIndicatorPhase,
  semanticIndicatorTooltip,
} from '../indicator'

function progress(
  patch: {
    source?: AiSemanticProgress['source']
    builtin?: Partial<AiSemanticProgress['builtin']>
    index?: Partial<AiSemanticProgress['index']>
  } = {},
): AiSemanticProgress {
  return {
    source: patch.source ?? 'builtin',
    builtin: { state: 'ready', ...patch.builtin },
    index: { state: 'idle', ...patch.index },
  }
}

function t(key: string, options?: Record<string, unknown>) {
  return options ? `${key} ${JSON.stringify(options)}` : key
}

describe('semantic indicator phase', () => {
  it('hides an idle index and a disabled source', () => {
    expect(semanticIndicatorPhase(progress())).toBe('hidden')
    expect(
      semanticIndicatorPhase(
        progress({ source: 'off', index: { state: 'error' } }),
      ),
    ).toBe('hidden')
    expect(
      semanticIndicatorPhase(
        progress({ builtin: { state: 'absent' }, index: { state: 'off' } }),
      ),
    ).toBe('hidden')
  })

  it('shows the model download and its failure', () => {
    expect(
      semanticIndicatorPhase(progress({ builtin: { state: 'downloading' } })),
    ).toBe('downloading')
    expect(
      semanticIndicatorPhase(progress({ builtin: { state: 'error' } })),
    ).toBe('error')
  })

  it('shows indexing and index errors', () => {
    expect(
      semanticIndicatorPhase(progress({ index: { state: 'indexing' } })),
    ).toBe('indexing')
    expect(
      semanticIndicatorPhase(progress({ index: { state: 'error' } })),
    ).toBe('error')
  })
})

describe('semantic indicator visibility', () => {
  it('appears only after a long download or indexing', () => {
    const since = nextBusySince('indexing', undefined, 1000)
    expect(since).toBe(1000)
    expect(isSemanticIndicatorVisible('indexing', since, 1500)).toBe(false)
    expect(
      isSemanticIndicatorVisible(
        'indexing',
        since,
        1000 + SEMANTIC_INDICATOR_DELAY_MS,
      ),
    ).toBe(true)
  })

  it('keeps the delay running when the download turns into indexing', () => {
    const since = nextBusySince('downloading', undefined, 1000)
    expect(nextBusySince('indexing', since, 1800)).toBe(1000)
  })

  it('disappears at once when the work ends and shows errors at once', () => {
    expect(nextBusySince('hidden', 1000, 5000)).toBeUndefined()
    expect(isSemanticIndicatorVisible('hidden', 1000, 5000)).toBe(false)
    expect(isSemanticIndicatorVisible('error', undefined, 0)).toBe(true)
  })
})

describe('semantic indicator percent', () => {
  it('uses the download progress and the share of embedded chunks', () => {
    expect(
      semanticIndicatorPercent(
        progress({ builtin: { state: 'downloading', progress: 42 } }),
        'downloading',
      ),
    ).toBe(42)
    expect(
      semanticIndicatorPercent(
        progress({ index: { state: 'indexing', done: 1, total: 3 } }),
        'indexing',
      ),
    ).toBe(33)
    expect(
      semanticIndicatorPercent(
        progress({ index: { state: 'indexing' } }),
        'indexing',
      ),
    ).toBeUndefined()
  })
})

describe('semantic indicator tooltip', () => {
  it('tells that word search already works while the model downloads or indexes', () => {
    expect(
      semanticIndicatorTooltip(
        progress({ builtin: { state: 'downloading', progress: 7 } }),
        'downloading',
        t,
        false,
      ),
    ).toBe(
      'ai.semantic.rail.downloading {"percent":7}\nai.semantic.rail.wordsReady',
    )
    expect(
      semanticIndicatorTooltip(
        progress({ index: { state: 'indexing', done: 5, total: 10 } }),
        'indexing',
        t,
        false,
      ),
    ).toBe(
      'ai.semantic.rail.indexing {"done":5,"total":10}\nai.semantic.rail.wordsReady',
    )
    expect(
      semanticIndicatorTooltip(
        progress({ index: { state: 'indexing' } }),
        'indexing',
        t,
        false,
      ),
    ).toBe('ai.semantic.rail.preparing\nai.semantic.rail.wordsReady')
  })

  it('reuses the existing error texts and points to the settings', () => {
    expect(
      semanticIndicatorTooltip(
        progress({ builtin: { state: 'error', error: 'runtime' } }),
        'error',
        t,
        true,
      ),
    ).toBe(
      'ai.semantic.builtin.errors.runtimeWindows\nai.semantic.rail.openSettings',
    )
    expect(
      semanticIndicatorTooltip(
        progress({ index: { state: 'error', error: 'timeout' } }),
        'error',
        t,
        false,
      ),
    ).toBe('ai.errors.timeout\nai.semantic.rail.openSettings')
  })
})
