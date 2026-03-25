import { SEARCH_DIACRITICS_RE, SEARCH_WORD_RE } from '../constants'

export function normalizeSearchValue(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  return value
    .normalize('NFD')
    .replace(SEARCH_DIACRITICS_RE, '')
    .toLocaleLowerCase()
}

export function splitSearchWords(value: string): string[] {
  return value.match(SEARCH_WORD_RE) || []
}

export function createWordTrigrams(value: string): string[] {
  if (value.length < 3) {
    return []
  }

  const trigrams: string[] = []
  for (let index = 0; index <= value.length - 3; index += 1) {
    trigrams.push(value.slice(index, index + 3))
  }

  return trigrams
}

export function buildSearchTokens(normalizedText: string): Set<string> {
  const tokens = new Set<string>()
  const words = splitSearchWords(normalizedText)

  for (const word of words) {
    tokens.add(`w:${word}`)
    for (const trigram of createWordTrigrams(word)) {
      tokens.add(`g:${trigram}`)
    }
  }

  return tokens
}

export function intersectSets(
  firstSet: Set<number>,
  secondSet: Set<number>,
): Set<number> {
  const [smallSet, largeSet]
    = firstSet.size <= secondSet.size
      ? [firstSet, secondSet]
      : [secondSet, firstSet]
  const intersection = new Set<number>()

  smallSet.forEach((id) => {
    if (largeSet.has(id)) {
      intersection.add(id)
    }
  })

  return intersection
}
