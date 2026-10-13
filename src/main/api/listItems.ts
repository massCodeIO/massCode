import type { NoteRecord, SnippetRecord } from '../storage/contracts'
import type { HttpRequestRecord } from '../storage/providers/markdown/http/runtime/types'

// Элементы списков без тел: общие для GET-списков API и результатов поиска палитры.

// Тела фрагментов не сериализуются: контент выбранного сниппета загружается через GET /snippets/:id.
export function toSnippetListItem(snippet: SnippetRecord) {
  return {
    ...snippet,
    contents: snippet.contents.map(({ id, label, language }) => ({
      id,
      label,
      language,
    })),
  }
}

// Контент выбранной заметки загружается через GET /notes/:id.
export function toNoteListItem({ content: _content, ...note }: NoteRecord) {
  return note
}

// body остаётся ленивым на диске: полная запись загружается через GET /http-requests/:id.
export function toHttpRequestListItem({
  body: _body,
  ...request
}: HttpRequestRecord) {
  return request
}
