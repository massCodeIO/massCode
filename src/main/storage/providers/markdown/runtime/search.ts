import type { MarkdownSnippet } from './types'
import { runtimeRef } from './constants'
import {
  buildSearchTokens,
  createWordTrigrams,
  intersectSets,
  normalizeSearchValue,
  splitSearchWords,
} from './shared/searchIndex'

function getSnippetSearchText(snippet: MarkdownSnippet): string {
  return normalizeSearchValue(
    [
      snippet.name,
      snippet.description || '',
      ...snippet.contents.map(content => content.value || ''),
    ].join('\n'),
  )
}

export function buildSearchIndex(snippets: MarkdownSnippet[]): {
  searchSnippetTextById: Map<number, string>
  searchTokenToSnippetIds: Map<string, Set<number>>
  searchTokensBySnippetId: Map<number, string[]>
} {
  const searchSnippetTextById = new Map<number, string>()
  const searchTokenToSnippetIds = new Map<string, Set<number>>()
  const searchTokensBySnippetId = new Map<number, string[]>()

  snippets.forEach((snippet) => {
    const searchText = getSnippetSearchText(snippet)
    const tokens = [...buildSearchTokens(searchText)]

    searchSnippetTextById.set(snippet.id, searchText)
    searchTokensBySnippetId.set(snippet.id, tokens)

    tokens.forEach((token) => {
      const tokenBucket
        = searchTokenToSnippetIds.get(token) || new Set<number>()
      tokenBucket.add(snippet.id)
      searchTokenToSnippetIds.set(token, tokenBucket)
    })
  })

  return {
    searchSnippetTextById,
    searchTokenToSnippetIds,
    searchTokensBySnippetId,
  }
}

export function invalidateRuntimeSearchIndex(state: { version: number }): void {
  const cache = runtimeRef.cache
  if (!cache || cache.state !== state) {
    return
  }

  cache.searchIndexDirty = true
  cache.searchQueryCache.clear()
}

function ensureRuntimeSearchIndex(
  snippets: MarkdownSnippet[],
): typeof runtimeRef.cache {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.snippets === snippets ? cache : null

  if (!runtimeCache) {
    return null
  }

  if (!runtimeCache.searchIndexDirty) {
    return runtimeCache
  }

  const {
    searchSnippetTextById,
    searchTokenToSnippetIds,
    searchTokensBySnippetId,
  } = buildSearchIndex(snippets)

  runtimeCache.searchSnippetTextById = searchSnippetTextById
  runtimeCache.searchTokenToSnippetIds = searchTokenToSnippetIds
  runtimeCache.searchTokensBySnippetId = searchTokensBySnippetId
  runtimeCache.searchQueryCache.clear()
  runtimeCache.searchIndexDirty = false

  return runtimeCache
}

export function getSnippetIdsBySearchQuery(
  snippets: MarkdownSnippet[],
  searchQuery: string,
): Set<number> {
  const normalizedSearchQuery = normalizeSearchValue(searchQuery).trim()
  if (!normalizedSearchQuery) {
    return new Set(snippets.map(snippet => snippet.id))
  }

  const runtimeCache = ensureRuntimeSearchIndex(snippets)
  if (!runtimeCache) {
    return new Set(
      snippets
        .filter((snippet) => {
          const searchText = getSnippetSearchText(snippet)
          return searchText.includes(normalizedSearchQuery)
        })
        .map(snippet => snippet.id),
    )
  }

  const cachedResult = runtimeCache.searchQueryCache.get(normalizedSearchQuery)
  if (cachedResult) {
    return new Set(cachedResult)
  }

  const queryWords = splitSearchWords(normalizedSearchQuery)
  let candidateSnippetIds: Set<number> | null = null

  if (queryWords.length > 0) {
    for (const word of queryWords) {
      const wordTrigrams = createWordTrigrams(word)
      let wordCandidates: Set<number> | null = null

      for (const trigram of wordTrigrams) {
        const trigramSnippetIds = runtimeCache.searchTokenToSnippetIds.get(
          `g:${trigram}`,
        )
        if (!trigramSnippetIds || trigramSnippetIds.size === 0) {
          wordCandidates = new Set()
          break
        }

        wordCandidates
          = wordCandidates === null
            ? new Set(trigramSnippetIds)
            : intersectSets(wordCandidates, trigramSnippetIds)

        if (wordCandidates.size === 0) {
          break
        }
      }

      if (wordCandidates === null) {
        const exactWordSnippetIds
          = runtimeCache.searchTokenToSnippetIds.get(`w:${word}`)
            || new Set<number>()
        wordCandidates = exactWordSnippetIds
      }

      candidateSnippetIds
        = candidateSnippetIds === null
          ? wordCandidates
          : intersectSets(candidateSnippetIds, wordCandidates)

      if (candidateSnippetIds.size === 0) {
        runtimeCache.searchQueryCache.set(normalizedSearchQuery, [])
        return new Set()
      }
    }
  }

  const matchedSnippetIds: number[] = []
  const snippetIdsToCheck
    = candidateSnippetIds || new Set(snippets.map(snippet => snippet.id))

  snippetIdsToCheck.forEach((snippetId) => {
    const searchText = runtimeCache.searchSnippetTextById.get(snippetId) || ''
    if (searchText.includes(normalizedSearchQuery)) {
      matchedSnippetIds.push(snippetId)
    }
  })

  runtimeCache.searchQueryCache.set(normalizedSearchQuery, matchedSnippetIds)
  return new Set(matchedSnippetIds)
}
