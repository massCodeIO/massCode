import { vi } from 'vitest'

// Хранилище vault для тестов корпуса и индекса: холодный runtime-кэш отдаёт тела только
// по getById или с withContent, как markdown-провайдер после перезапуска.
export interface MockRecord {
  id: number
  name: string
  folder?: string
  sig?: string
  isDeleted?: number
  pendingCloudDownload?: boolean
}
export interface MockSnippet extends MockRecord {
  description?: string | null
  contents: { label: string, language: string, value: string }[]
}
export interface MockNote extends MockRecord {
  content: string
}
export interface MockRequest extends MockRecord {
  method: string
  url: string
  description: string
}
export interface MockVault {
  snippets: MockSnippet[]
  notes: MockNote[]
  requests: MockRequest[]
}

export function createMockVault(): MockVault {
  return { snippets: [], notes: [], requests: [] }
}

function signatures(records: MockRecord[]) {
  return new Map(
    records
      .filter(record => !record.isDeleted)
      .map(record => [
        record.id,
        {
          sig: record.sig ?? `sig-${record.id}`,
          pendingCloudDownload: record.pendingCloudDownload === true,
        },
      ]),
  )
}

function snippet(record: MockSnippet, withContent: boolean) {
  const loaded = withContent && !record.pendingCloudDownload
  return {
    ...record,
    description: record.description ?? null,
    isDeleted: record.isDeleted ?? 0,
    folder: record.folder ? { id: 1, name: record.folder } : null,
    contents: record.contents.map(content => ({
      ...content,
      id: 0,
      value: loaded ? content.value : null,
    })),
  }
}

function note(record: MockNote, withContent: boolean) {
  const loaded = withContent && !record.pendingCloudDownload
  return {
    ...record,
    isDeleted: record.isDeleted ?? 0,
    content: loaded ? record.content : '',
  }
}

export function createStorageMock(vault: () => MockVault) {
  const live = <T extends MockRecord>(records: T[]) =>
    records.filter(record => !record.isDeleted)
  const snippets = {
    getSnippetSignatures: vi.fn(() => signatures(vault().snippets)),
    getSnippets: vi.fn(() =>
      live(vault().snippets).map(record => snippet(record, false)),
    ),
    getSnippetsAsync: vi.fn(async (query: { withContent?: boolean }) =>
      live(vault().snippets).map(record =>
        snippet(record, Boolean(query.withContent)),
      ),
    ),
    getSnippetById: vi.fn((id: number) => {
      const record = vault().snippets.find(item => item.id === id)
      return record ? snippet(record, true) : null
    }),
  }
  const notes = {
    getNoteSignatures: vi.fn(() => signatures(vault().notes)),
    getNotes: vi.fn(() =>
      live(vault().notes).map(record => note(record, false)),
    ),
    getNotesAsync: vi.fn(async (query: { withContent?: boolean }) =>
      live(vault().notes).map(record =>
        note(record, Boolean(query.withContent)),
      ),
    ),
    getNoteById: vi.fn((id: number) => {
      const record = vault().notes.find(item => item.id === id)
      return record ? note(record, true) : null
    }),
  }
  const requests = {
    getRequestSignatures: vi.fn(() => signatures(vault().requests)),
    getRequests: vi.fn(() =>
      live(vault().requests).map(record => ({ ...record, isDeleted: 0 })),
    ),
  }
  return {
    snippets,
    notes,
    requests,
    module: {
      useStorage: () => ({ snippets }),
      useNotesStorage: () => ({ notes }),
      useHttpStorage: () => ({ requests, folders: { getFolders: () => [] } }),
    },
  }
}
