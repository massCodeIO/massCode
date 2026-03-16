import type { MarkdownNote, NotesState } from './types'
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

function ensureNotesSearchIndex(notes: MarkdownNote[]): void {
  const cache = notesRuntimeRef.cache
  if (!cache || !cache.searchIndexDirty) {
    return
  }

  const index = buildNotesSearchIndex(notes)
  cache.searchTokenToNoteIds = index.searchTokenToNoteIds
  cache.searchTokensByNoteId = index.searchTokensByNoteId
  cache.searchNoteTextById = index.searchNoteTextById
  cache.searchIndexDirty = false
}

export function getNoteIdsBySearchQuery(
  notes: MarkdownNote[],
  searchQuery: string,
): number[] {
  const cache = notesRuntimeRef.cache
  if (!cache) {
    return []
  }

  const normalizedQuery = normalizeSearchValue(searchQuery.trim())
  if (!normalizedQuery) {
    return notes.map(n => n.id)
  }

  const cached = cache.searchQueryCache.get(normalizedQuery)
  if (cached) {
    return cached
  }

  ensureNotesSearchIndex(notes)

  const queryWords = splitSearchWords(normalizedQuery)
  if (queryWords.length === 0) {
    return notes.map(n => n.id)
  }

  let candidateIds: Set<number> | null = null

  for (const word of queryWords) {
    const wordCandidates = new Set<number>()
    const trigrams = createWordTrigrams(word)

    for (const trigram of trigrams) {
      const token = `g:${trigram}`
      const noteIds = cache.searchTokenToNoteIds.get(token)
      if (noteIds) {
        for (const id of noteIds) {
          wordCandidates.add(id)
        }
      }
    }

    if (candidateIds === null) {
      candidateIds = wordCandidates
    }
    else {
      for (const id of candidateIds) {
        if (!wordCandidates.has(id)) {
          candidateIds.delete(id)
        }
      }
    }
  }

  if (!candidateIds || candidateIds.size === 0) {
    cache.searchQueryCache.set(normalizedQuery, [])
    return []
  }

  // Filter by full text match
  const results: number[] = []
  for (const id of candidateIds) {
    const text = cache.searchNoteTextById.get(id)
    if (!text) {
      continue
    }

    const allWordsMatch = queryWords.every(word => text.includes(word))
    if (allWordsMatch) {
      results.push(id)
    }
  }

  cache.searchQueryCache.set(normalizedQuery, results)
  return results
}
