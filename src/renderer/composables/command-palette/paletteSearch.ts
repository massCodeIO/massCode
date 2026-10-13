import type { SpaceId } from '@/spaceDefinitions'
import type { AiVaultRef } from '~/shared/ai'
import type {
  AiSemanticSearch,
  AiSemanticSearchResult,
} from '~/shared/aiSemantic'
import {
  MIN_MEANING_QUERY_WEIGHT,
  semanticQueryWeight,
} from '~/shared/aiSemantic'
import { MAX_USAGE_SCORE } from './ranking'

export type PaletteSearchPhase = AiSemanticSearch['mode']

// Слова отвечают за мгновенный список, поэтому задержка только сглаживает быстрый набор.
export const WORDS_DEBOUNCE_MS = 50
// Смысловая фаза дороже (эмбеддинг запроса): ждём паузу в наборе.
export const FULL_DELAY_MS = 150
// Сколько пустой по словам ответ нового ввода ждёт full, держа прежний список: full может стоять
// в очереди воркера секундами, а Enter по устаревшему списку всё это время заблокирован.
export const DEFERRED_WORDS_MAX_MS = 600
const MAX_USAGE_TIE_BREAK = 0.3

const TYPES_BY_SCOPE: Partial<Record<SpaceId, AiVaultRef['type']>> = {
  code: 'snippet',
  notes: 'note',
  http: 'http_request',
}

export function getPaletteSearchTypes(scope?: SpaceId): AiVaultRef['type'][] {
  if (!scope)
    return ['snippet', 'note', 'http_request']
  const type = TYPES_BY_SCOPE[scope]
  return type ? [type] : []
}

interface PaletteSearchFilter {
  id: number
  spaceId: SpaceId
}

// Парсер палитры выставляет #tag и /folder только вместе со скоупом; фильтр другого
// пространства (или без скоупа) отбрасывается, иначе main отклонит payload.
export function buildPaletteSearchPayload(input: {
  query: string
  mode: PaletteSearchPhase
  scopeSpaceId?: SpaceId
  tagFilter?: PaletteSearchFilter
  folderFilter?: PaletteSearchFilter
}): AiSemanticSearch | null {
  const query = input.query.trim()
  const types = getPaletteSearchTypes(input.scopeSpaceId)
  if (!query || !types.length)
    return null
  const scoped = Boolean(input.scopeSpaceId) && types.length === 1
  const tagId
    = scoped
      && types[0] !== 'http_request'
      && input.tagFilter?.spaceId === input.scopeSpaceId
      ? input.tagFilter?.id
      : undefined
  const folderId
    = scoped && input.folderFilter?.spaceId === input.scopeSpaceId
      ? input.folderFilter?.id
      : undefined
  return {
    query: query.slice(0, 500),
    types,
    mode: input.mode,
    ...(tagId !== undefined ? { tagId } : {}),
    ...(folderId !== undefined ? { folderId } : {}),
  }
}

// Тот же порог, что в main: по одной-двум буквам смысловой хит почти всегда мусор.
export function shouldRunFullPhase(
  meaning: AiSemanticSearchResult['meaning'],
  query: string,
) {
  return (
    meaning === 'ready'
    && semanticQueryWeight(query) >= MIN_MEANING_QUERY_WEIGHT
  )
}

// Пока ждём смысловую фазу, «ничего не найдено» преждевременно: результат может прийти через миг.
// Но уже показанное пустое состояние держится до реальных результатов, иначе ожидание смысла
// на каждой следующей букве прятало бы его и оно мигало.
export function shouldShowContentEmpty(input: {
  settled: boolean
  hasResults: boolean
  hasLocalMatches: boolean
  meaningPending: boolean
  shownBefore?: boolean
}) {
  return (
    input.settled
    && !input.hasResults
    && !input.hasLocalMatches
    && (!input.meaningPending || Boolean(input.shownBefore))
  )
}

export interface AppliedPaletteResponse {
  generation: number
  phase: PaletteSearchPhase
}

// Ответ устарел, если ввод уже изменился; поздний words не должен перетирать уже показанный full.
export function acceptsPaletteResponse(
  currentGeneration: number,
  applied: AppliedPaletteResponse | undefined,
  response: AppliedPaletteResponse,
) {
  if (response.generation !== currentGeneration)
    return false
  return !(
    response.phase === 'words'
    && applied?.generation === response.generation
    && applied.phase === 'full'
  )
}

export function getUsageTieBreak(usageScore: number) {
  return Math.min(
    MAX_USAGE_TIE_BREAK,
    (Math.max(0, usageScore) / MAX_USAGE_SCORE) * MAX_USAGE_TIE_BREAK,
  )
}

// Usage переставляет только сильные результаты между собой: граница strong/weak остаётся за main.
// Первые fixedCount уже показаны словами и стоят на своих местах (см. mergeMeaningResults).
export function splitPaletteResults<T extends { id: string }>(
  items: readonly { result: T, score: number }[],
  strongCount: number,
  getUsageScore: (id: string) => number,
  fixedCount = 0,
) {
  const fixed = Math.min(fixedCount, strongCount)
  const ranked = items
    .slice(fixed, strongCount)
    .map((item, index) => ({
      index,
      result: item.result,
      score: item.score + getUsageTieBreak(getUsageScore(item.result.id)),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(item => item.result)
  return {
    strong: [...items.slice(0, fixed).map(item => item.result), ...ranked],
    weak: items.slice(strongCount).map(item => item.result),
  }
}

// Смысловая фаза не переставляет то, что уже показано словами: сильные слов остаются сверху
// в показанном порядке (даже если full их не вернул), за ними новые сильные full, затем слабые full.
export function mergeMeaningResults<T>(input: {
  wordsStrong: readonly T[]
  full: readonly T[]
  fullStrongCount: number
  getKey: (item: T) => string
}) {
  const { wordsStrong, full, fullStrongCount, getKey } = input
  if (!wordsStrong.length)
    return { items: [...full], strongCount: fullStrongCount, fixedCount: 0 }
  const fullByKey = new Map(full.map(item => [getKey(item), item]))
  const placed = new Set<string>()
  const items: T[] = []
  const place = (item: T) => {
    placed.add(getKey(item))
    items.push(item)
  }
  // Свежая версия из full: у неё актуальные причина совпадения и фрагмент.
  for (const item of wordsStrong) place(fullByKey.get(getKey(item)) ?? item)
  const fixedCount = items.length
  for (const item of full.slice(0, fullStrongCount)) {
    if (!placed.has(getKey(item)))
      place(item)
  }
  const strongCount = items.length
  for (const item of full.slice(fullStrongCount)) {
    if (!placed.has(getKey(item)))
      place(item)
  }
  return { items, strongCount, fixedCount }
}

// Слабые раскрыты сразу до этого числа, остальные прячутся за строкой «ещё N».
export const WEAK_PREVIEW_LIMIT = 3

export interface ExcerptSegment {
  text: string
  match: boolean
}

export function splitExcerpt(
  text: string,
  ranges: readonly (readonly [number, number])[],
): ExcerptSegment[] {
  const sorted = ranges
    .map(
      ([from, to]) =>
        [
          Math.max(0, Math.min(from, text.length)),
          Math.max(0, Math.min(to, text.length)),
        ] as const,
    )
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0])
  const segments: ExcerptSegment[] = []
  let cursor = 0
  for (const [from, to] of sorted) {
    const start = Math.max(from, cursor)
    if (to <= start)
      continue
    if (start > cursor)
      segments.push({ text: text.slice(cursor, start), match: false })
    segments.push({ text: text.slice(start, to), match: true })
    cursor = to
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), match: false })
  return segments
}
