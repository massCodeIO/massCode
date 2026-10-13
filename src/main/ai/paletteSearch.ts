import type {
  AiSemanticSearch,
  AiSemanticSearchResult,
} from '../../shared/aiSemantic'
import type { CorpusType } from './semantic/corpus'
import {
  toHttpRequestListItem,
  toNoteListItem,
  toSnippetListItem,
} from '../api/listItems'
import { useHttpStorage, useNotesStorage, useStorage } from '../storage'
import { searchVault } from './semantic/searchVault'

// Записи под фильтром тега или папки: только id, сами записи не сохраняются.
function filteredRefs(type: CorpusType, tagId?: number, folderId?: number) {
  const records
    = type === 'snippet'
      ? useStorage().snippets.getSnippets({ isDeleted: 0, tagId, folderId })
      : type === 'note'
        ? useNotesStorage().notes.getNotes({ isDeleted: 0, tagId, folderId })
        : useHttpStorage().requests.getRequests({ isDeleted: 0, folderId })
  return new Set(records.map(record => `${type}:${record.id}`))
}

// List-элементы только найденных записей. Списки собираются из runtime без чтения файлов;
// getById дочитал бы тело и поднял бы ожидающую облака запись в очереди докачки.
function listItems(refs: Set<string>) {
  const items = new Map<string, Record<string, unknown>>()
  const wanted = (type: CorpusType) =>
    [...refs].some(ref => ref.startsWith(`${type}:`))
  if (wanted('snippet')) {
    for (const record of useStorage().snippets.getSnippets({ isDeleted: 0 })) {
      if (refs.has(`snippet:${record.id}`))
        items.set(`snippet:${record.id}`, toSnippetListItem(record))
    }
  }
  if (wanted('note')) {
    for (const record of useNotesStorage().notes.getNotes({ isDeleted: 0 })) {
      if (refs.has(`note:${record.id}`))
        items.set(`note:${record.id}`, toNoteListItem(record))
    }
  }
  if (wanted('http_request')) {
    for (const record of useHttpStorage().requests.getRequests({
      isDeleted: 0,
    })) {
      if (refs.has(`http_request:${record.id}`))
        items.set(`http_request:${record.id}`, toHttpRequestListItem(record))
    }
  }
  return items
}

// Поиск палитры: найденные записи отдаются list-элементами без тел, renderer не запрашивает их по одной.
export async function searchPalette(
  input: AiSemanticSearch,
): Promise<AiSemanticSearchResult> {
  const { tagId, folderId } = input
  // Тип отсекает сам searchVault; списки нужны только для фильтра тега или папки.
  const allowed
    = tagId !== undefined || folderId !== undefined
      ? filteredRefs(input.types[0], tagId, folderId)
      : undefined
  const result = await searchVault({
    query: input.query,
    types: input.types,
    mode: input.mode,
    limit: input.limit,
    ...(allowed ? { allow: (ref: string) => allowed.has(ref) } : {}),
  })
  const items = listItems(new Set(result.items.map(found => found.ref)))
  // Запись могла исчезнуть между поиском и сборкой списка: сильные считаются по оставшимся.
  const kept = result.items.filter(found => items.has(found.ref))
  return {
    items: kept.map(found => ({
      type: found.type,
      item: items.get(found.ref)!,
      score: found.score,
      reason: found.reason,
      ...(found.excerpt ? { excerpt: found.excerpt } : {}),
    })),
    strongCount: result.items
      .slice(0, result.strongCount)
      .filter(found => items.has(found.ref))
      .length,
    meaning: result.meaning,
  }
}
