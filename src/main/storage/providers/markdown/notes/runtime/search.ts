import type { MarkdownNote, NotesRuntimeCache, NotesState } from './types'
import { SEARCH_DIACRITICS_RE, SEARCH_WORD_RE } from '../../runtime/constants'
import { notesRuntimeRef } from './constants'

function normalizeSearchValue(value: string): string {
  return value.normalize('NFD').replace(SEARCH_DIACRITICS_RE, '').toLowerCase()
}

function splitSearchWords(value: string): string[] {
  return value.match(SEARCH_WORD_RE) || []
}

function createWordTrigrams(word: string): string[] {
  const trigrams: string[] = []
  if (word.length < 3) {
    trigrams.push(word)
    return trigrams
  }

  for (let i = 0; i <= word.length - 3; i++) {
    trigrams.push(word.slice(i, i + 3))
  }

  return trigrams
}

function buildSearchTokens(normalizedText: string): Set<string> {
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

function buildNoteSearchText(note: MarkdownNote): string {
  const parts: string[] = [note.name]
  if (note.description) {
    parts.push(note.description)
  }
  if (note.content) {
    parts.push(note.content)
  }
  return parts.join(' ')
}

export function buildNotesSearchIndex(notes: MarkdownNote[]): {
  searchTokenToNoteIds: Map<string, Set<number>>
  searchTokensByNoteId: Map<number, string[]>
  searchNoteTextById: Map<number, string>
} {
  const searchTokenToNoteIds = new Map<string, Set<number>>()
  const searchTokensByNoteId = new Map<number, string[]>()
  const searchNoteTextById = new Map<number, string>()

  for (const note of notes) {
    const rawText = buildNoteSearchText(note)
    const normalizedText = normalizeSearchValue(rawText)
    searchNoteTextById.set(note.id, normalizedText)

    const tokens = buildSearchTokens(normalizedText)
    const tokenArray = [...tokens]
    searchTokensByNoteId.set(note.id, tokenArray)

    for (const token of tokenArray) {
      let noteIds = searchTokenToNoteIds.get(token)
      if (!noteIds) {
        noteIds = new Set()
        searchTokenToNoteIds.set(token, noteIds)
      }
      noteIds.add(note.id)
    }
  }

  return { searchTokenToNoteIds, searchTokensByNoteId, searchNoteTextById }
}

export function invalidateNotesSearchIndex(_state: NotesState): void {
  const cache = notesRuntimeRef.cache
  if (cache) {
    cache.searchIndexDirty = true
    cache.searchQueryCache.clear()
  }
}

function ensureNotesSearchIndex(
  notes: MarkdownNote[],
): NotesRuntimeCache | null {
  const cache = notesRuntimeRef.cache
  if (!cache) {
    return null
  }

  if (!cache.searchIndexDirty) {
    return cache
  }

  const index = buildNotesSearchIndex(notes)
  cache.searchTokenToNoteIds = index.searchTokenToNoteIds
  cache.searchTokensByNoteId = index.searchTokensByNoteId
  cache.searchNoteTextById = index.searchNoteTextById
  cache.searchIndexDirty = false

  return cache
}

function intersectSets(
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

export function getNoteIdsBySearchQuery(
  notes: MarkdownNote[],
  searchQuery: string,
): number[] {
  const normalizedQuery = normalizeSearchValue(searchQuery).trim()
  if (!normalizedQuery) {
    return notes.map(n => n.id)
  }

  const runtimeCache = ensureNotesSearchIndex(notes)
  if (!runtimeCache) {
    // Fallback: linear scan
    return notes
      .filter((note) => {
        const searchText = normalizeSearchValue(buildNoteSearchText(note))
        return searchText.includes(normalizedQuery)
      })
      .map(n => n.id)
  }

  const cachedResult = runtimeCache.searchQueryCache.get(normalizedQuery)
  if (cachedResult) {
    return cachedResult
  }

  const queryWords = splitSearchWords(normalizedQuery)
  let candidateIds: Set<number> | null = null

  if (queryWords.length > 0) {
    for (const word of queryWords) {
      const wordTrigrams = createWordTrigrams(word)
      let wordCandidates: Set<number> | null = null

      for (const trigram of wordTrigrams) {
        const trigramNoteIds = runtimeCache.searchTokenToNoteIds.get(
          `g:${trigram}`,
        )
        if (!trigramNoteIds || trigramNoteIds.size === 0) {
          wordCandidates = new Set()
          break
        }

        wordCandidates
          = wordCandidates === null
            ? new Set(trigramNoteIds)
            : intersectSets(wordCandidates, trigramNoteIds)

        if (wordCandidates.size === 0) {
          break
        }
      }

      if (wordCandidates === null) {
        const exactWordNoteIds
          = runtimeCache.searchTokenToNoteIds.get(`w:${word}`)
            || new Set<number>()
        wordCandidates = exactWordNoteIds
      }

      candidateIds
        = candidateIds === null
          ? wordCandidates
          : intersectSets(candidateIds, wordCandidates)

      if (candidateIds.size === 0) {
        runtimeCache.searchQueryCache.set(normalizedQuery, [])
        return []
      }
    }
  }

  // Final verification: full text substring match
  const results: number[] = []
  const idsToCheck = candidateIds || new Set(notes.map(n => n.id))

  idsToCheck.forEach((noteId) => {
    const searchText = runtimeCache.searchNoteTextById.get(noteId) || ''
    if (searchText.includes(normalizedQuery)) {
      results.push(noteId)
    }
  })

  runtimeCache.searchQueryCache.set(normalizedQuery, results)
  return results
}
