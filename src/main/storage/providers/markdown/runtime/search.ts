import type { MarkdownSnippet } from './types'
import { runtimeRef } from './constants'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
} from './shared/searchEngine'

export function getSnippetSearchText(snippet: MarkdownSnippet): string {
  return [
    snippet.name,
    snippet.description || '',
    ...snippet.contents.map(content => content.value || ''),
  ].join('\n')
}

export function getSnippetIdsBySearchQuery(
  snippets: MarkdownSnippet[],
  searchQuery: string,
): Set<number> {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.snippets === snippets ? cache : null

  if (runtimeCache && runtimeCache.searchIndex.dirty) {
    runtimeCache.searchIndex = buildSearchIndex(snippets, getSnippetSearchText)
  }

  return querySearchIndex(
    snippets,
    searchQuery,
    runtimeCache?.searchIndex ?? null,
    getSnippetSearchText,
  )
}

export function invalidateRuntimeSearchIndex(state: { version: number }): void {
  const cache = runtimeRef.cache
  if (!cache || cache.state !== state) {
    return
  }

  invalidateSearchIndex(cache.searchIndex)
}

export { buildSearchIndex }
