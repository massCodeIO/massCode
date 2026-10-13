import type { KeywordHit } from './keywordIndex'
import { dot, normalize } from './text'

// Чистые функции без electron: их вызывает и поиск в main, и eval-runner на собранном build.

export interface ScoringOptions {
  meaningWeight: number
  wordWeight: number
  nameWeight: number
  // Степень coverage: частичное совпадение слов весит заметно меньше полного.
  power: number
  // Нижняя граница порога смысла; на обычном индексе действует шумовой порог (noiseMargin).
  // Смысловые записи между zGate и шумовым порогом попадают только в свёрнутые слабые.
  zGate: number
  // Шумовой порог смысла: ожидаемый максимум z случайного запроса sqrt(2 ln n) плюс запас.
  noiseMargin: number
  // Смысловой хит выше шумового порога на столько поднимается вровень с записями, где нашлись все слова.
  strongMargin: number
  // Лучший слабый хит при пустой сильной части становится видимым, если z + отрыв от второго ≥ порог + это.
  promoteMargin: number
  coverageGate: number
  // Для кодов и путей смысл почти пуст: его вес умножается, вес слов растёт.
  lookupMeaning: number
  lookupWords: number
  // z одной записи не превышает sqrt(n - 1): на маленьком индексе z заменяется растянутым косинусом.
  smallIndex: number
  smallBase: number
  smallScale: number
  // На маленьком индексе z недоступен, а косинусы шума соседствуют с верными (vault из нескольких записей:
  // второй по близости 0.60–0.70, верный 0.60–0.84), поэтому подъём smallBase отрезал бы и верные. Сильным
  // считается только смысл не дальше этого (в единицах растянутого z) от лучшего, остальное выше zGate уходит в свёрнутые.
  // 2026-10-13, маленький vault: лишний смысл среди сильных у 5 из 6 пересказов -> 1 из 6, R@1 0.9 и MRR 0.92 те же.
  smallMargin: number
  // На почти одинаковых косинусах sd стремится к нулю и раздувает z у шума.
  minSd: number
  // Хвостовые чанки длинных записей скорятся, но не входят в статистику.
  scaleChunks: number
  // Совпадение названия не ниже начала слова закрепляет запись среди сильных; «содержит» (0.4) — нет.
  pinnedName: number
  foldRatio: number
  limit: number
}

// 2026-10-13, eval на копии реального vault (v6-demo: 146 записей, 196 векторов; 46 запросов + 25 без ответа)
// и синтетический vault (92 + 10). Было (центрирование, z-гейт 2, смысл в сумме при любом z):
// v6 R@1 0.761, мусор по смыслу среди сильных на всех 25 запросах без ответа; синтетика R@1 0.946.
// z по сырому косинусу без центрирования: максимум шума на v6 q95 3.35 / max 3.51 против 3.75 / 3.94 с
// центрированием, медиана верного ответа та же (3.60). Шумовой порог sqrt(2 ln 196) + 0.25 = 3.5:
// v6 R@1 0.826, мусор среди сильных 1 из 25 (раньше 25 из 25), выдача при верном ответе не падает;
// синтетика R@1 0.859, мусор 0 из 10. Порог 3.25: v6 мусор 3 из 25, синтетика 1 из 10; 3.75 — R@1 0.804.
// Пересказы и кросс-язычные запросы часто дают верный ответ со z 2.5–3.5, поэтому смысл от zGate до порога
// не отбрасывается, а уходит в свёрнутые слабые: v6 R@1 0.891 / MRR 0.923 (если отбрасывать — 0.826 / 0.836),
// синтетика 0.902 / 0.928 (0.859 / 0.860); среди сильных мусор тот же, но у 18 из 20 бессмысленных запросов
// появляется свёрнутый хвост в среднем из 5 записей.
// wordWeight 1/2/3 и strongMargin 1/2 на этих наборах не меняют ни одной метрики.
export const SCORING: ScoringOptions = {
  meaningWeight: 1,
  wordWeight: 1,
  nameWeight: 2,
  power: 1.5,
  zGate: 2,
  noiseMargin: 0.25,
  strongMargin: 2,
  promoteMargin: 0.25,
  coverageGate: 0.5,
  lookupMeaning: 0.5,
  lookupWords: 2,
  smallIndex: 30,
  smallBase: 0.5,
  smallScale: 20,
  smallMargin: 1,
  minSd: 0.02,
  scaleChunks: 40,
  pinnedName: 0.6,
  foldRatio: 0.5,
  limit: 20,
}

export interface ChunkVector {
  ref: string
  n: number
  vector: ArrayLike<number>
}

export interface PreparedVectors {
  chunks: { ref: string, n: number, vector: Float32Array }[]
  // Число чанков, по которым считается статистика z.
  scaleSize: number
}

// Векторы не центрируются: вычитание среднего с повторной нормировкой раздувало почти пустые записи
// около среднего («Untitled» с одной картинкой всплывала на случайные запросы).
export function prepareVectors(
  vectors: ChunkVector[],
  options: Pick<ScoringOptions, 'scaleChunks'> = SCORING,
): PreparedVectors {
  return {
    scaleSize: vectors.filter(item => item.n <= options.scaleChunks).length,
    chunks: vectors.map(item => ({
      ref: item.ref,
      n: item.n,
      vector: normalize(item.vector),
    })),
  }
}

export interface MeaningHit {
  z: number
  // Косинус лучшего чанка: на маленьком индексе он заменяет z.
  similarity: number
  n: number
}

// Лучший чанк записи по z сырого косинуса; статистика по всему индексу, фильтры применяются позже.
export function rankChunks(
  queryVector: ArrayLike<number>,
  prepared: PreparedVectors,
  options: Pick<ScoringOptions, 'minSd' | 'scaleChunks'> = SCORING,
) {
  const hits = new Map<string, MeaningHit>()
  if (!prepared.chunks.length)
    return hits
  const query = normalize(queryVector)
  const scores = prepared.chunks.map(chunk => ({
    chunk,
    similarity: dot(query, chunk.vector),
  }))
  const inScale = scores.filter(
    score => score.chunk.n <= options.scaleChunks,
  )
  const scale = inScale.length ? inScale : scores
  const mean
    = scale.reduce((sum, score) => sum + score.similarity, 0) / scale.length
  const variance
    = scale.reduce((sum, score) => sum + (score.similarity - mean) ** 2, 0)
      / scale.length
  const sd = Math.max(options.minSd, Math.sqrt(variance))
  for (const score of scores) {
    const z = (score.similarity - mean) / sd
    const best = hits.get(score.chunk.ref)
    if (!best || z > best.z) {
      hits.set(score.chunk.ref, {
        z,
        similarity: Math.max(score.similarity, best?.similarity ?? -1),
        n: score.chunk.n,
      })
    }
    else if (score.similarity > best.similarity) {
      best.similarity = score.similarity
    }
  }
  return hits
}

export type MatchReason = 'name' | 'words' | 'meaning' | 'both'

export interface ScoredResult {
  ref: string
  score: number
  reason: MatchReason
  z: number
  coverage: number
  textCoverage: number
  nameScore: number
  // Все слова найдены в названии или тексте, название совпало с начала слова или смысл заметно выше шума: такая запись
  // стоит выше остальных и не сворачивается.
  pinned: boolean
  // Смысл ниже шумового порога и нет слов: запись стоит после всех и всегда свёрнута.
  weak: boolean
}

export interface CombineContext {
  lookup: boolean
  // Размер статистики z; меньше smallIndex — включается фолбэк по косинусу.
  scaleSize: number
  // Фильтр по типу, тегу или папке до отбора и обрезки до limit.
  allow?: (ref: string) => boolean
}

function reasonOf(
  meaning: boolean,
  words: boolean,
  name: boolean,
): MatchReason {
  if (name)
    return 'name'
  if (meaning && words)
    return 'both'
  return meaning ? 'meaning' : 'words'
}

export function meaningGate(
  scaleSize: number,
  options: ScoringOptions = SCORING,
) {
  if (scaleSize < options.smallIndex)
    return options.zGate
  return Math.max(
    options.zGate,
    Math.sqrt(2 * Math.log(scaleSize)) + options.noiseMargin,
  )
}

// Смысл ниже шумового порога в счёт не входит: без уверенного смыслового хита сильная часть фазы full
// та же, что у фазы слов; меняется только свёрнутый хвост.
export function combine(
  meaning: Map<string, MeaningHit>,
  words: Map<string, KeywordHit>,
  context: CombineContext,
  options: ScoringOptions = SCORING,
): ScoredResult[] {
  const small = context.scaleSize < options.smallIndex
  const zOf = (ref: string) => {
    const hit = meaning.get(ref)
    if (!hit)
      return 0
    return small
      ? Math.max(0, (hit.similarity - options.smallBase) * options.smallScale)
      : hit.z
  }
  // Лучший считается среди допустимых записей: отфильтрованный хит не должен свернуть остальные.
  const gate = small
    ? Math.max(
        options.zGate,
        Math.max(
          0,
          ...[...meaning.keys()]
            .filter(ref => !context.allow || context.allow(ref))
            .map(zOf),
        ) - options.smallMargin,
      )
    : meaningGate(context.scaleSize, options)
  const meaningWeight
    = options.meaningWeight * (context.lookup ? options.lookupMeaning : 1)
  const wordWeight
    = options.wordWeight * (context.lookup ? options.lookupWords : 1)
  const results: ScoredResult[] = []
  for (const ref of new Set([...meaning.keys(), ...words.keys()])) {
    if (context.allow && !context.allow(ref))
      continue
    const z = zOf(ref)
    const hit = words.get(ref)
    const coverage = hit?.coverage ?? 0
    const name = hit?.nameScore ?? 0
    const meaningHit = z >= gate
    const wordsHit = coverage >= options.coverageGate
    if (!meaningHit && !wordsHit && name <= 0) {
      if (z >= options.zGate) {
        results.push({
          ref,
          score: meaningWeight * z,
          reason: 'meaning',
          z,
          coverage,
          textCoverage: hit?.textCoverage ?? 0,
          nameScore: name,
          pinned: false,
          weak: true,
        })
      }
      continue
    }
    results.push({
      ref,
      score:
        (meaningHit ? meaningWeight * z : 0)
        + wordWeight * coverage ** options.power
        + options.nameWeight * name,
      reason: reasonOf(meaningHit, wordsHit, name > 0),
      z,
      coverage,
      textCoverage: hit?.textCoverage ?? 0,
      nameScore: name,
      // Папка добирает coverage, но не закрепляет: иначе «background» закрепил бы всю папку Background Jobs.
      pinned:
        hit?.textCoverage === 1
        || name >= options.pinnedName
        || z >= gate + options.strongMargin,
      weak: false,
    })
  }
  const tier = (result: ScoredResult) =>
    result.pinned ? 2 : result.weak ? 0 : 1
  const sorted = results
    .sort(
      (a, b) =>
        tier(b) - tier(a)
        || b.score - a.score
        || (words.get(b.ref)?.bm25 ?? 0) - (words.get(a.ref)?.bm25 ?? 0)
        || a.ref.localeCompare(b.ref),
    )
    .slice(0, options.limit)
  // Ничего сильного нет, а лучший смысловой хит заметно оторвался от следующего: он виден, а не свёрнут.
  // Второй берётся по всему индексу, а не среди допустимых: фильтр на одну-две записи иначе делал бы
  // любой хит «оторвавшимся». Без второго хита отрыв не измерить, и запись остаётся свёрнутой.
  if (!small && sorted[0]?.weak) {
    const top = sorted[0]
    // Цикл, а не Math.max(...spread): на большом индексе разворот аргументов падает с RangeError.
    let second = Number.NEGATIVE_INFINITY
    for (const ref of meaning.keys()) {
      if (ref !== top.ref)
        second = Math.max(second, zOf(ref))
    }
    if (
      Number.isFinite(second)
      && top.z + (top.z - second) >= gate + options.promoteMargin
    ) {
      sorted[0] = { ...top, weak: false }
    }
  }
  return sorted
}

// Сильные — закреплённые записи и префикс со score не ниже доли лучшего; остальное сворачивается.
export function strongCount(
  results: ScoredResult[],
  options: Pick<ScoringOptions, 'foldRatio'> = SCORING,
) {
  if (!results.length)
    return 0
  const floor = results[0].score * options.foldRatio
  const folded = results.findIndex(
    result => result.weak || (!result.pinned && result.score < floor),
  )
  return folded === -1 ? results.length : folded
}
