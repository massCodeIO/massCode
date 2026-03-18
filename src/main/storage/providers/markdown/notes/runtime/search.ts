import type { MarkdownNote, NotesRuntimeCache, NotesState } from './types'
import {
  buildSearchTokens,
  createWordTrigrams,
  intersectSets,
  normalizeSearchValue,
  splitSearchWords,
} from '../../runtime/shared/searchIndex'
import { notesRuntimeRef } from './constants'

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

export function invalidateNotesSearchIndex(state: NotesState): void {
  const cache = notesRuntimeRef.cache
  if (!cache || cache.state !== state) {
    return
  }

  cache.searchIndexDirty = true
  cache.searchQueryCache.clear()
}

function ensureNotesSearchIndex(
  notes: MarkdownNote[],
): NotesRuntimeCache | null {
  const cache = notesRuntimeRef.cache
  const runtimeCache = cache?.notes === notes ? cache : null
  if (!runtimeCache) {
    return null
  }

  if (!runtimeCache.searchIndexDirty) {
    return runtimeCache
  }

  const index = buildNotesSearchIndex(notes)
  runtimeCache.searchTokenToNoteIds = index.searchTokenToNoteIds
  runtimeCache.searchTokensByNoteId = index.searchTokensByNoteId
  runtimeCache.searchNoteTextById = index.searchNoteTextById
  runtimeCache.searchQueryCache.clear()
  runtimeCache.searchIndexDirty = false

  return runtimeCache
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
    return [...cachedResult]
  }

  const queryWords = splitSearchWords(normalizedQuery)
  let candidateIds: Set<number> | null = null

  if (queryWords.length > 0) {
    for (const word of queryWords) {
      if (word.length < 3) {
        continue
      }

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

  runtimeCache.searchQueryCache.set(normalizedQuery, [...results])
  return [...results]
}
