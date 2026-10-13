import { normalizeText, queryWords, termOf, wordSpans } from './terms'

// Чистые функции без electron: их вызывает и поиск в main, и eval-runner на собранном build.

export interface KeywordDocument {
  ref: string
  name: string
  body: string
  // Имя папки: находит запись по теме папки, но весит меньше и не делает совпадение полным.
  folder?: string
}

interface Posting {
  name: number
  body: number
  folder: number
}

interface IndexedDocument {
  // Нормализованное имя: nameScore на каждом запросе не нормализует заново.
  name: string
  terms: string[]
  words: string[]
  length: number
}

export interface KeywordIndex {
  postings: Map<string, Map<string, Posting>>
  docs: Map<string, IndexedDocument>
  totalLength: number
  // Исходные нормализованные слова (не стемы) с числом документов и стемом: префикс дописываемого
  // слова сравнивается с ними, иначе «strin» не нашёл бы «string» (стем «str»).
  words: Map<string, { count: number, stem: string }>
  // Отсортированные слова строятся при первом префиксном поиске и дальше правятся точечно.
  sortedWords?: string[]
}

export interface KeywordHit {
  // Доля термов запроса, найденных в записи: основной сигнал слов.
  coverage: number
  // То же без имени папки: все слова в названии или тексте самой записи.
  textCoverage: number
  // Только для отбора кандидатов и тай-брейка.
  bm25: number
  nameScore: number
  matchedTerms: string[]
  // Стемы, которые нашлись в записи, включая раскрытые из префикса: по ним подсвечивается excerpt.
  matchedStems: string[]
}

export interface KeywordSearchOptions {
  // Последний терм как префикс: пользователь ещё дописывает слово.
  prefixLast: boolean
  k1: number
  b: number
  limit: number
}

export const KEYWORD_SEARCH: KeywordSearchOptions = {
  prefixLast: true,
  k1: 1.2,
  b: 0.75,
  limit: 100,
}

// Совпадение в названии весит втрое больше, чем в теле; имя папки — вдвое меньше.
const NAME_WEIGHT = 3
const FOLDER_WEIGHT = 0.5

export function createKeywordIndex(): KeywordIndex {
  return {
    postings: new Map(),
    docs: new Map(),
    totalLength: 0,
    words: new Map(),
  }
}

function lowerBound(list: string[], value: string) {
  let low = 0
  let high = list.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (list[middle] < value)
      low = middle + 1
    else high = middle
  }
  return low
}

function addWord(index: KeywordIndex, word: string, stem: string) {
  const entry = index.words.get(word)
  if (entry) {
    entry.count++
    return
  }
  index.words.set(word, { count: 1, stem })
  index.sortedWords?.splice(lowerBound(index.sortedWords, word), 0, word)
}

function removeWord(index: KeywordIndex, word: string) {
  const entry = index.words.get(word)
  if (!entry)
    return
  if (entry.count > 1) {
    entry.count--
    return
  }
  index.words.delete(word)
  if (index.sortedWords)
    index.sortedWords.splice(lowerBound(index.sortedWords, word), 1)
}

// Индексируемые слова документа со стемами: нормализованные, без служебных и однобуквенных.
function documentWords(text: string) {
  const words: { word: string, term: string }[] = []
  for (const span of wordSpans(text)) {
    const word = normalizeText(span.text)
    const term = termOf(word)
    if (term)
      words.push({ word, term })
  }
  return words
}

function normalizeName(text: string) {
  return normalizeText(text).replace(/\s+/g, ' ').trim()
}

export function removeKeywordDocument(index: KeywordIndex, ref: string) {
  const doc = index.docs.get(ref)
  if (!doc)
    return
  for (const term of doc.terms) {
    const postings = index.postings.get(term)
    postings?.delete(ref)
    if (postings && !postings.size)
      index.postings.delete(term)
  }
  for (const word of doc.words) removeWord(index, word)
  index.totalLength -= doc.length
  index.docs.delete(ref)
}

export function updateKeywordDocument(
  index: KeywordIndex,
  document: KeywordDocument,
) {
  removeKeywordDocument(index, document.ref)
  const counts = new Map<string, Posting>()
  const nameWords = documentWords(document.name)
  const bodyWords = documentWords(document.body)
  const folderWords = documentWords(document.folder ?? '')
  const count = (words: { term: string }[], field: keyof Posting) => {
    for (const { term } of words) {
      const posting = counts.get(term) ?? { name: 0, body: 0, folder: 0 }
      posting[field]++
      counts.set(term, posting)
    }
  }
  count(nameWords, 'name')
  count(bodyWords, 'body')
  count(folderWords, 'folder')
  for (const [term, posting] of counts) {
    let postings = index.postings.get(term)
    if (!postings) {
      postings = new Map()
      index.postings.set(term, postings)
    }
    postings.set(document.ref, posting)
  }
  const length
    = NAME_WEIGHT * nameWords.length
      + bodyWords.length
      + FOLDER_WEIGHT * folderWords.length
  const stemByWord = new Map(
    [...nameWords, ...bodyWords, ...folderWords].map(item => [
      item.word,
      item.term,
    ]),
  )
  for (const [word, term] of stemByWord) addWord(index, word, term)
  const words = [...stemByWord.keys()]
  index.docs.set(document.ref, {
    name: normalizeName(document.name),
    terms: [...counts.keys()],
    words,
    length,
  })
  index.totalLength += length
}

export function buildKeywordIndex(documents: KeywordDocument[]) {
  const index = createKeywordIndex()
  for (const document of documents) updateKeywordDocument(index, document)
  return index
}

function scoreName(target: string, search: string) {
  if (!search || !target)
    return 0
  if (target === search)
    return 1
  if (target.startsWith(search))
    return 0.8
  if (target.split(/[^\p{L}\p{N}]+/u).some(token => token.startsWith(search)))
    return 0.6
  return target.includes(search) ? 0.4 : 0
}

export function nameScore(name: string, query: string) {
  return scoreName(normalizeName(name), normalizeName(query))
}

// Стемы слов с префиксом: бинарный поиск по отсортированным исходным словам, а не обход словаря.
function stemsWithPrefix(index: KeywordIndex, prefix: string) {
  index.sortedWords ??= [...index.words.keys()].sort()
  const words = index.sortedWords
  const stems = new Set<string>()
  for (
    let position = lowerBound(words, prefix);
    position < words.length && words[position].startsWith(prefix);
    position++
  )
    stems.add(index.words.get(words[position])!.stem)
  // Целиком набранное слово находит и другие формы: «notes» — заметку со словом «note».
  const own = termOf(prefix)
  if (own)
    stems.add(own)
  return stems
}

// allow отсекает записи до ранжирования и обрезки до limit: иначе фильтр по типу, тегу или папке
// мог бы получить пустой список, когда top-100 заняли записи другого типа.
export function searchKeywords(
  index: KeywordIndex,
  query: string,
  options: KeywordSearchOptions = KEYWORD_SEARCH,
  allow: (ref: string) => boolean = () => true,
) {
  const { terms, prefix } = queryWords(query, options.prefixLast)
  // Дописываемое слово — отдельный терм: его стемы ищутся по префиксу, в matchedTerms идёт сам префикс.
  const groups = [
    ...terms.map(term => ({ label: term, stems: [term] })),
    ...(prefix
      ? [{ label: prefix, stems: [...stemsWithPrefix(index, prefix)] }]
      : []),
  ]
  const total = index.docs.size
  const averageLength = total ? index.totalLength / total : 0
  const scores = new Map<
    string,
    { bm25: number, matched: string[], inText: number, stems: string[] }
  >()
  for (const group of groups) {
    const matches = new Map<string, Posting & { stems: string[] }>()
    for (const token of group.stems) {
      for (const [ref, posting] of index.postings.get(token) ?? []) {
        if (!allow(ref))
          continue
        const merged = matches.get(ref) ?? {
          name: 0,
          body: 0,
          folder: 0,
          stems: [],
        }
        merged.name += posting.name
        merged.body += posting.body
        merged.folder += posting.folder
        merged.stems.push(token)
        matches.set(ref, merged)
      }
    }
    const idf = Math.log(
      1 + (total - matches.size + 0.5) / (matches.size + 0.5),
    )
    for (const [ref, posting] of matches) {
      const tf
        = NAME_WEIGHT * posting.name
          + posting.body
          + FOLDER_WEIGHT * posting.folder
      const length = index.docs.get(ref)!.length
      const norm
        = 1
          - options.b
          + options.b * (averageLength ? length / averageLength : 1)
      const score = scores.get(ref) ?? {
        bm25: 0,
        matched: [],
        inText: 0,
        stems: [],
      }
      score.bm25 += (idf * tf * (options.k1 + 1)) / (tf + options.k1 * norm)
      score.matched.push(group.label)
      if (posting.name + posting.body > 0)
        score.inText++
      score.stems.push(...posting.stems)
      scores.set(ref, score)
    }
  }
  const search = normalizeName(query)
  const hits = new Map<string, KeywordHit>()
  const ranked = [...scores]
    .sort((a, b) => b[1].bm25 - a[1].bm25)
    .slice(0, options.limit)
  for (const [ref, score] of ranked) {
    hits.set(ref, {
      coverage: score.matched.length / groups.length,
      textCoverage: score.inText / groups.length,
      bm25: score.bm25,
      nameScore: scoreName(index.docs.get(ref)!.name, search),
      matchedTerms: score.matched,
      matchedStems: [...new Set(score.stems)],
    })
  }
  // Совпадение названия засчитывается и без общих термов: стоп-слово или одна буква в названии.
  for (const [ref, doc] of index.docs) {
    if (hits.has(ref) || !allow(ref))
      continue
    const score = scoreName(doc.name, search)
    if (score > 0) {
      hits.set(ref, {
        coverage: 0,
        textCoverage: 0,
        bm25: 0,
        nameScore: score,
        matchedTerms: [],
        matchedStems: [],
      })
    }
  }
  return hits
}
