import type { CorpusChanges, CorpusEntry, CorpusType } from './corpus'
import type { Excerpt } from './excerpt'
import type { KeywordHit } from './keywordIndex'
import type {
  MatchReason,
  MeaningHit,
  PreparedVectors,
  ScoredResult,
} from './score'
import type { MeaningState } from './vectorIndex'
import {
  MIN_MEANING_QUERY_WEIGHT,
  semanticQueryWeight,
} from '../../../shared/aiSemantic'
import { chunkRecord, keywordDocument } from './chunks'
import { vaultCorpus } from './corpus'
import { currentSemanticKey, embedQuery } from './embeddings'
import { meaningExcerpt, wordExcerpt } from './excerpt'
import { KEYWORD_SEARCH, searchKeywords } from './keywordIndex'
import { combine, rankChunks, SCORING, strongCount } from './score'
import { isLookup } from './terms'
import {
  meaningState,
  readPreparedVectors,
  syncIndexInBackground,
} from './vectorIndex'

export interface SearchVaultInput {
  query: string
  types: CorpusType[]
  // Фильтр по тегу или папке: применяется до отбора, z-статистика считается по всему индексу.
  allow?: (ref: string) => boolean
  // words — только слова и имя, на каждое нажатие; full — ещё и смысл, после паузы в наборе.
  mode: 'words' | 'full'
  limit?: number
}

export interface SearchVaultItem {
  ref: string
  type: CorpusType
  id: number
  name: string
  score: number
  reason: MatchReason
  // Смысл ниже шумового порога: запись всегда в свёрнутой части.
  weak: boolean
  // Доля слов запроса, найденных в записи; textCoverage — без имени папки.
  coverage: number
  textCoverage: number
  excerpt?: Excerpt
}

export interface SearchVaultResult {
  items: SearchVaultItem[]
  strongCount: number
  // off — семантика выключена, модели нет или индексация для этого ключа упала.
  meaning: MeaningState
}

const QUERY_TIMEOUT_MS = 10_000

function hasChanges(changes: CorpusChanges) {
  return Boolean(
    changes.added.length || changes.changed.length || changes.removed.length,
  )
}

function parseRef(ref: string) {
  const separator = ref.lastIndexOf(':')
  return {
    type: ref.slice(0, separator) as CorpusType,
    id: Number(ref.slice(separator + 1)),
  }
}

function excerptOf(
  entry: CorpusEntry,
  result: ScoredResult,
  words: KeywordHit | undefined,
  meaning: MeaningHit | undefined,
): Excerpt | undefined {
  if (!entry.record)
    return undefined
  if (words?.matchedStems.length) {
    const excerpt = wordExcerpt(
      keywordDocument(entry.record).body,
      words.matchedStems,
    )
    if (excerpt)
      return excerpt
  }
  // Найденное только по смыслу показывает начало чанка, который совпал.
  if (meaning && (result.reason === 'meaning' || result.reason === 'both')) {
    const chunks = chunkRecord(entry.record)
    // Совпал вектор названия заметки: отрывком служит начало её текста.
    const chunk = chunks[meaning.n]?.name ? chunks[0] : chunks[meaning.n]
    if (chunk?.text && !chunk.name)
      return meaningExcerpt(chunk.text)
  }
  return undefined
}

export async function searchVault(
  input: SearchVaultInput,
): Promise<SearchVaultResult> {
  const key = currentSemanticKey()
  let changes: CorpusChanges = { added: [], changed: [], removed: [] }
  try {
    changes = await vaultCorpus.refresh()
  }
  catch (error) {
    // Поиск идёт по корпусу, собранному прошлым обновлением: пустой ответ хуже немного устаревшего.
    console.error('[masscode:semantic]', error)
  }
  const meaning = await meaningState(key)
  // Изменённые записи до переэмбеддинга ранжируются старыми векторами, индекс догоняет в фоне.
  if (key && hasChanges(changes))
    syncIndexInBackground(key, true)
  else if (key && meaning === 'warming')
    syncIndexInBackground(key)
  const query = input.query.trim()
  if (!query)
    return { items: [], strongCount: 0, meaning }

  const types = new Set<string>(input.types)
  const allow = (ref: string) =>
    vaultCorpus.entries.has(ref)
    && types.has(parseRef(ref).type)
    && (!input.allow || input.allow(ref))
  const words = searchKeywords(
    vaultCorpus.keyword,
    query,
    KEYWORD_SEARCH,
    allow,
  )
  let hits = new Map<string, MeaningHit>()
  let prepared: PreparedVectors | undefined
  if (
    input.mode === 'full'
    && semanticQueryWeight(query) >= MIN_MEANING_QUERY_WEIGHT
    && key
    && meaning === 'ready'
  ) {
    try {
      prepared = await readPreparedVectors(key)
      // На индексе без векторов (только дампы и пустые записи) эмбеддить запрос незачем.
      if (prepared?.chunks.length) {
        hits = rankChunks(
          await embedQuery(key, query, AbortSignal.timeout(QUERY_TIMEOUT_MS)),
          prepared,
        )
      }
    }
    catch {
      // Запрос без смысла лучше, чем ошибка: слова уже найдены.
    }
  }
  const results = combine(
    hits,
    words,
    { lookup: isLookup(query), scaleSize: prepared?.scaleSize ?? 0, allow },
    { ...SCORING, limit: input.limit ?? SCORING.limit },
  )
  return {
    items: results.map((result) => {
      const entry = vaultCorpus.entries.get(result.ref)!
      const excerpt = excerptOf(
        entry,
        result,
        words.get(result.ref),
        hits.get(result.ref),
      )
      return {
        ref: result.ref,
        ...parseRef(result.ref),
        name: entry.name,
        score: result.score,
        reason: result.reason,
        coverage: result.coverage,
        textCoverage: result.textCoverage,
        weak: result.weak,
        ...(excerpt ? { excerpt } : {}),
      }
    }),
    strongCount: strongCount(results),
    meaning,
  }
}
