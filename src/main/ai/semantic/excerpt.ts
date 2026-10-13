import type { WordSpan } from './terms'
import { termOf, wordSpans } from './terms'

// Чистые функции без electron. Подсветка — диапазоны [from, to) в тексте excerpt, без HTML.

export interface Excerpt {
  text: string
  ranges: [number, number][]
}

export const EXCERPT_LENGTH = 240
const WINDOW_WORDS = 12
const BEFORE_WORDS = Math.floor(WINDOW_WORDS / 3)

function cut(text: string, length: number) {
  if (text.length <= length)
    return text
  const space = text.lastIndexOf(' ', length)
  return text.slice(0, space > length / 2 ? space : length)
}

export function meaningExcerpt(text: string, length = EXCERPT_LENGTH): Excerpt {
  return { text: cut(text.replace(/\s+/g, ' ').trim(), length), ranges: [] }
}

// Окно в 12 слов вокруг первого совпадения, треть окна до него. Текст читается до конца окна,
// не целиком. stems — matchedStems из searchKeywords: в них уже раскрыт префикс дописываемого
// слова, поэтому подсвечивается и запись, найденная по стему, а не по началу слова.
export function wordExcerpt(
  text: string,
  stems: string[],
  length = EXCERPT_LENGTH,
): Excerpt | undefined {
  const flat = text.replace(/\s+/g, ' ')
  const wanted = new Set(stems)
  const matches = (span: WordSpan) => {
    const term = termOf(span.text)
    return Boolean(term && wanted.has(term))
  }
  const window: { span: WordSpan, matched: boolean }[] = []
  let found = false
  for (const span of wordSpans(flat)) {
    const matched = matches(span)
    if (!found) {
      window.push({ span, matched })
      if (!matched) {
        if (window.length > BEFORE_WORDS)
          window.shift()
        continue
      }
      found = true
      continue
    }
    window.push({ span, matched })
    if (window.length >= WINDOW_WORDS)
      break
  }
  if (!found)
    return undefined
  const from = window[0].span.from
  const excerpt = cut(flat.slice(from, window.at(-1)!.span.to), length)
  const ranges: [number, number][] = window
    .filter(item => item.matched && item.span.to - from <= excerpt.length)
    .map(item => [item.span.from - from, item.span.to - from])
  return { text: excerpt, ranges }
}
