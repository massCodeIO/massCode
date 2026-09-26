import type { HttpRequestRecord } from '../../storage/providers/markdown/http/runtime/types'
import { expect, it } from 'vitest'
import { httpRequestRevision } from '../requestRevision'

const request: HttpRequestRecord = {
  id: 1,
  createdAt: 1,
  updatedAt: 1,
  name: 'Request',
  folderId: null,
  method: 'GET',
  url: 'https://example.test',
  headers: [],
  query: [],
  bodyType: 'none',
  body: null,
  formData: [],
  auth: { type: 'none' },
  description: '',
  isDeleted: 0,
  isFavorites: 0,
  filePath: 'Request.md',
}

it('ignores UI metadata and runtime while invalidating content, deletion and identity changes', () => {
  const revision = httpRequestRevision(request)
  expect(
    httpRequestRevision({ ...request, isFavorites: 1, updatedAt: 2 }),
  ).toBe(revision)
  expect(
    httpRequestRevision({
      ...request,
      runtime: { version: 2 },
    } as HttpRequestRecord),
  ).toBe(revision)
  for (const change of [
    { id: 2 },
    { createdAt: 2 },
    { name: 'Changed' },
    { folderId: 2 },
    { body: 'changed' },
    { isDeleted: 1 },
  ]) {
    expect(httpRequestRevision({ ...request, ...change })).not.toBe(revision)
  }
})

it('hashes nested objects independently of JSON key insertion order', () => {
  const first = {
    ...request,
    headers: [{ key: 'X-Test', value: 'one', enabled: true }],
  }
  const reordered = {
    ...request,
    headers: [{ enabled: true, value: 'one', key: 'X-Test' }],
  }
  expect(httpRequestRevision(first)).toBe(httpRequestRevision(reordered))
})
