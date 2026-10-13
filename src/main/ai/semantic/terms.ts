// Чистые функции без electron: их вызывает и поиск в main, и eval-runner на собранном build.

// Служебные слова не несут намерения поиска: «как настроить» должно искать «настроить».
const STOP_WORDS = new Set([
  // en
  'a',
  'an',
  'the',
  'of',
  'for',
  'with',
  'in',
  'on',
  'to',
  'from',
  'by',
  'and',
  'or',
  'is',
  'are',
  'be',
  'it',
  'its',
  'as',
  'at',
  'this',
  'that',
  'do',
  'does',
  'how',
  'what',
  'my',
  'me',
  'we',
  'our',
  'you',
  'your',
  'if',
  'into',
  'not',
  'can',
  // ru
  'и',
  'в',
  'во',
  'на',
  'с',
  'со',
  'по',
  'для',
  'как',
  'что',
  'чтобы',
  'к',
  'ко',
  'из',
  'у',
  'о',
  'об',
  'не',
  'а',
  'но',
  'от',
  'до',
  'это',
  'мы',
  'наш',
  'я',
  'мой',
  'он',
  'она',
  'они',
  'ли',
  'же',
  'бы',
  'за',
  'при',
  'над',
  'под',
  'без',
  'так',
  'там',
  'тут',
  'где',
  'когда',
  'если',
  'или',
  'все',
  'есть',
  'быть',
  'его',
  'ее',
])

// Порядок важен: сначала длинные окончания, иначе «-ами» срезалось бы как «-и».
const RU_SUFFIXES = [
  'иями',
  'ями',
  'ами',
  'ией',
  'ого',
  'его',
  'ому',
  'ему',
  'ыми',
  'ими',
  'ые',
  'ых',
  'ым',
  'их',
  'им',
  'ах',
  'ях',
  'ой',
  'ей',
  'ий',
  'ый',
  'ая',
  'яя',
  'ое',
  'ее',
  'ом',
  'ем',
  'ам',
  'ям',
  'ов',
  'ев',
  'ую',
  'юю',
  'ью',
  'ия',
  'ие',
  'а',
  'я',
  'о',
  'е',
  'ы',
  'и',
  'у',
  'ю',
  'ь',
]
const MIN_STEM = 3

const CYRILLIC = /\p{Script=Cyrillic}/u
const LATIN = /^[a-z]+$/
// Для языков без пробелов между словами слова выделяет сегментер ICU.
const SEGMENTED
  = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })

export function normalizeText(text: string) {
  return text.normalize('NFKC').toLowerCase().replaceAll('ё', 'е')
}

function stripRussian(term: string) {
  const suffix = RU_SUFFIXES.find(
    ending =>
      term.endsWith(ending) && term.length - ending.length >= MIN_STEM,
  )
  return suffix ? term.slice(0, -suffix.length) : term
}

function stripEnglish(term: string) {
  const longEnough = (length: number) => term.length - length >= MIN_STEM
  if (term.endsWith('ing') && longEnough(3))
    return term.slice(0, -3)
  if (term.endsWith('ed') && longEnough(2))
    return term.slice(0, -2)
  // -es только после шипящих (boxes, matches); notes и files теряют лишь -s, а e снимается ниже.
  if (/(?:[sxz]|ch|sh)es$/.test(term) && longEnough(2))
    return term.slice(0, -2)
  if (term.endsWith('s') && !term.endsWith('ss') && longEnough(1))
    return term.slice(0, -1)
  return term
}

function fixedPoint(term: string, strip: (term: string) => string) {
  let current = term
  for (let next = strip(current); next !== current; next = strip(current))
    current = next
  return current
}

// 2026-10-12, eval S1: стемминг, отсутствие стемминга и префикс из 5 букв дали одинаковый ALL MRR 0.972.
// Срез повторяется до неподвижной точки, иначе strings -> string, но string -> str. У английских слов
// после среза снимается конечное e: note/notes, create/created/creating сходятся в одну основу.
export function stem(term: string) {
  if (CYRILLIC.test(term))
    return fixedPoint(term, stripRussian)
  // Английский стемминг только для слов из букв: идентификаторы вроде e4012 или v2 не трогаются.
  if (!LATIN.test(term))
    return term
  const base = fixedPoint(term, stripEnglish)
  return base.endsWith('e') && base.length - 1 >= MIN_STEM
    ? base.slice(0, -1)
    : base
}

export interface WordSpan {
  from: number
  to: number
  text: string
}

// Слова исходного текста с позициями: общие для индекса и подсветки excerpt.
export function* wordSpans(text: string): Generator<WordSpan> {
  // Комбинирующие знаки (NFD-диакритика, тайские огласовки) не рвут слово.
  for (const match of text.matchAll(/[\p{L}\p{M}\p{N}_]+/gu)) {
    if (!SEGMENTED.test(match[0])) {
      yield {
        from: match.index,
        to: match.index + match[0].length,
        text: match[0],
      }
      continue
    }
    for (const segment of segmenter.segment(match[0])) {
      if (segment.isWordLike) {
        const from = match.index + segment.index
        yield {
          from,
          to: from + segment.segment.length,
          text: segment.segment,
        }
      }
    }
  }
}

// Терм одного слова: undefined для служебных и слишком коротких слов.
export function termOf(word: string) {
  const token = normalizeText(word)
  if (token.length < 2 || STOP_WORDS.has(token))
    return undefined
  return stem(token)
}

// Все термы по порядку, с повторами: нужны для частот.
export function tokenize(text: string) {
  const terms: string[] = []
  for (const span of wordSpans(text)) {
    const term = termOf(span.text)
    if (term)
      terms.push(term)
  }
  return terms
}

export function queryTerms(text: string) {
  return [...new Set(tokenize(text))]
}

export interface QueryWords {
  terms: string[]
  // Последнее слово, которое пользователь ещё дописывает: сравнивается префиксом с исходными
  // словами документа, а не со стемом, иначе выдача пропадала бы на промежуточных префиксах.
  prefix?: string
}

export function queryWords(text: string, prefixLast: boolean): QueryWords {
  const words = [...wordSpans(text)].map(span => normalizeText(span.text))
  const last = prefixLast ? words.at(-1) : undefined
  // Одна буква совпала бы почти со всеми словами vault: такой префикс не ищется.
  const prefix
    = last && last.length >= 2 && !STOP_WORDS.has(last) ? last : undefined
  const terms = new Set<string>()
  for (const word of prefix ? words.slice(0, -1) : words) {
    const term = termOf(word)
    if (term)
      terms.add(term)
  }
  return { terms: [...terms], prefix }
}

// Код ошибки, идентификатор или путь: смысл такого запроса почти пуст, решают точные слова.
function isLookupWord(word: string) {
  const digits = word.replace(/\D/g, '').length
  return (
    (digits > 0 && (/\p{L}/u.test(word) || digits >= 4))
    || /^\/[\w./{}-]+$/.test(word)
    || /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(word)
  )
}

export function isLookup(query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every(isLookupWord)
}
