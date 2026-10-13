import type { NoteRecord, SnippetRecord } from '../../storage/contracts'
import type { HttpRequestRecord } from '../../storage/providers/markdown/http/runtime/types'
import { describe, expect, it } from 'vitest'
import {
  toHttpRequestListItem,
  toNoteListItem,
  toSnippetListItem,
} from '../listItems'

const snippet = {
  id: 1,
  name: 'Hosts',
  description: 'Inventory',
  tags: [{ id: 2, name: 'ops' }],
  folder: { id: 3, name: 'Infra' },
  contents: [{ id: 4, label: 'hosts.ini', language: 'ini', value: '[web]' }],
  isFavorites: 0,
  isDeleted: 0,
  createdAt: 1,
  updatedAt: 2,
  pendingCloudDownload: false,
} satisfies SnippetRecord
const note = {
  id: 1,
  name: 'Release',
  description: null,
  content: 'body',
  properties: { status: 'done' },
  tags: [],
  folder: null,
  isFavorites: 1,
  isDeleted: 0,
  createdAt: 1,
  updatedAt: 2,
} satisfies NoteRecord
const request = {
  id: 5,
  name: 'Orders',
  method: 'GET',
  url: 'https://api.test/orders',
  body: '{"secret":true}',
  description: 'Lists orders',
} as unknown as HttpRequestRecord

// Прежние inline-преобразования из routes: результат списков API не должен измениться.
describe('list items', () => {
  it('match the previous route serialization', () => {
    expect(toSnippetListItem(snippet)).toEqual({
      ...snippet,
      contents: snippet.contents.map(({ id, label, language }) => ({
        id,
        label,
        language,
      })),
    })
    const { content: _content, ...noteItem } = note
    expect(toNoteListItem(note)).toEqual(noteItem)
    const { body: _body, ...requestItem } = request
    expect(toHttpRequestListItem(request)).toEqual(requestItem)
    expect(
      JSON.stringify([
        toSnippetListItem(snippet),
        toNoteListItem(note),
        toHttpRequestListItem(request),
      ]),
    ).not.toMatch(/\[web\]|"body"|secret/)
  })
})
