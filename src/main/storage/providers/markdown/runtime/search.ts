import type { MarkdownSnippet, Paths } from './types'
import { runtimeRef } from './cache'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
} from './shared/searchEngine'
import { ensureSnippetContentLoaded } from './snippets'

export function getSnippetSearchText(snippet: MarkdownSnippet): string {
  return [
    snippet.name,
    snippet.description || '',
    ...snippet.contents.map(content => content.value || ''),
  ].join('\n')
}

// Полнотекстовый поиск требует тел: ленивые записи (построенные из индекса
// без чтения файлов) дочитываются перед построением поискового индекса.
// Стоимость — одно чтение файла на запись при первом поиске за сессию.
function ensureSearchableContentLoaded(
  snippets: MarkdownSnippet[],
  paths: Paths,
): boolean {
  let hasLoadedContent = false

  for (const snippet of snippets) {
    if (
      !snippet.pendingCloudDownload
      && snippet.contents.some(content => content.value === null)
      && ensureSnippetContentLoaded(paths, snippet)
    ) {
      hasLoadedContent = true
    }
  }

  return hasLoadedContent
}

export function getSnippetIdsBySearchQuery(
  snippets: MarkdownSnippet[],
  searchQuery: string,
): Set<number> {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.snippets === snippets ? cache : null

  if (
    runtimeCache
    && ensureSearchableContentLoaded(snippets, runtimeCache.paths)
  ) {
    invalidateSearchIndex(runtimeCache.searchIndex)
  }

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
