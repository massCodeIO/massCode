import {
  buildSearchTokens,
  createWordTrigrams,
  intersectSets,
  normalizeSearchValue,
  splitSearchWords,
} from './searchIndex'

export interface SearchIndex {
  textById: Map<number, string>
  tokenToIds: Map<string, Set<number>>
  queryCache: Map<string, number[]>
  dirty: boolean
}

export function buildSearchIndex<T extends { id: number }>(
  items: T[],
  getSearchText: (item: T) => string,
): SearchIndex {
  const textById = new Map<number, string>()
  const tokenToIds = new Map<string, Set<number>>()

  for (const item of items) {
    const normalizedText = normalizeSearchValue(getSearchText(item))
    textById.set(item.id, normalizedText)

    const tokens = buildSearchTokens(normalizedText)
    for (const token of tokens) {
      let ids = tokenToIds.get(token)
      if (!ids) {
        ids = new Set()
        tokenToIds.set(token, ids)
      }
      ids.add(item.id)
    }
  }

  return { textById, tokenToIds, queryCache: new Map(), dirty: false }
}

export function querySearchIndex<T extends { id: number }>(
  items: T[],
  query: string,
  index: SearchIndex | null,
  getSearchText: (item: T) => string,
): Set<number> {
  const normalizedQuery = normalizeSearchValue(query).trim()
  if (!normalizedQuery) {
    return new Set(items.map(item => item.id))
  }

  if (!index) {
    return new Set(
      items
        .filter(item =>
          normalizeSearchValue(getSearchText(item)).includes(normalizedQuery),
        )
        .map(item => item.id),
    )
  }

  const cachedResult = index.queryCache.get(normalizedQuery)
  if (cachedResult) {
    return new Set(cachedResult)
  }

  const queryWords = splitSearchWords(normalizedQuery)
  let candidateIds: Set<number> | null = null

  if (queryWords.length > 0) {
    for (const word of queryWords) {
      const wordTrigrams = createWordTrigrams(word)
      let wordCandidates: Set<number> | null = null

      for (const trigram of wordTrigrams) {
        const trigramIds = index.tokenToIds.get(`g:${trigram}`)
        if (!trigramIds || trigramIds.size === 0) {
          wordCandidates = new Set()
          break
        }

        wordCandidates
          = wordCandidates === null
            ? new Set(trigramIds)
            : intersectSets(wordCandidates, trigramIds)

        if (wordCandidates.size === 0) {
          break
        }
      }

      if (wordCandidates === null) {
        wordCandidates = new Set(items.map(item => item.id))
      }

      candidateIds
        = candidateIds === null
          ? wordCandidates
          : intersectSets(candidateIds, wordCandidates)

      if (candidateIds.size === 0) {
        index.queryCache.set(normalizedQuery, [])
        return new Set()
      }
    }
  }

  const matchedIds: number[] = []
  const idsToCheck = candidateIds || new Set(items.map(item => item.id))

  idsToCheck.forEach((id) => {
    const searchText = index.textById.get(id) || ''
    if (searchText.includes(normalizedQuery)) {
      matchedIds.push(id)
    }
  })

  index.queryCache.set(normalizedQuery, matchedIds)
  return new Set(matchedIds)
}

export function invalidateSearchIndex(index: SearchIndex): void {
  index.dirty = true
  index.queryCache.clear()
}
