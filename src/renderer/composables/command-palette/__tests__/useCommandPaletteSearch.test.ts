import type {
  AiSemanticSearch,
  AiSemanticSearchResult,
} from '~/shared/aiSemantic'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

interface PendingSearch {
  payload: AiSemanticSearch
  settled: boolean
  resolve: (data: AiSemanticSearchResult) => void
  fail: () => void
}

const { invoke, searches } = vi.hoisted(() => {
  const searches: PendingSearch[] = []
  const invoke = vi.fn((channel: string, payload: unknown) => {
    if (channel !== 'system:ai:semantic-search')
      return Promise.resolve({ ok: false, error: 'invalidRequest' })
    return new Promise((resolve) => {
      const search: PendingSearch = {
        payload: payload as AiSemanticSearch,
        settled: false,
        resolve: (data) => {
          search.settled = true
          resolve({ ok: true, data })
        },
        fail: () => {
          search.settled = true
          resolve({ ok: false, error: 'connection' })
        },
      }
      searches.push(search)
    })
  })
  return { invoke, searches }
})

vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { invoke },
  store: { app: { get: () => undefined, set: vi.fn() } },
}))
vi.mock('@/router', () => ({ router: { push: vi.fn() }, RouterName: {} }))
vi.mock('@/services/api', () => ({ api: {} }))
vi.mock('@/spaceDefinitions', () => ({
  getActiveSpaceId: () => 'code',
  getSpaceDefinitions: () =>
    ['code', 'notes', 'http'].map(id => ({
      id,
      label: id,
      tooltip: id,
      icon: {},
    })),
}))
vi.mock('@/composables/spaces/http', () => ({
  useHttpApp: () => ({}),
  useHttpFolders: () => ({}),
  useHttpRequests: () => ({}),
  useHttpSearch: () => ({}),
}))
vi.mock('@/composables/spaces/http/runtimeNavigation', () => ({
  httpRuntimeNavigation: {},
}))
vi.mock('@/composables/spaces/notes', () => ({
  useNotes: () => ({}),
  useNotesApp: () => ({}),
  useNoteSearch: () => ({}),
}))
vi.mock('@/composables/useImportDialog', () => ({
  useImportDialog: () => ({}),
}))
vi.mock('@/composables/useSonner', () => ({
  useSonner: () => ({ sonner: vi.fn() }),
}))
vi.mock('../httpCommands', () => ({
  createHttpRequestFromPalette: vi.fn(),
  getHttpCommands: () => [],
}))

Object.assign(globalThis, {
  computed,
  ref,
  shallowRef,
  watch,
  window: new EventTarget(),
})
const { useCommandPalette } = await import('../../useCommandPalette')
const palette = useCommandPalette()

function response(
  names: string[],
  meaning: AiSemanticSearchResult['meaning'] = 'ready',
): AiSemanticSearchResult {
  return {
    items: names.map((name, index) => ({
      type: 'snippet',
      item: { id: index + 1, name, folder: null },
      score: 1 - index * 0.1,
      reason: 'words',
    })),
    strongCount: names.length,
    meaning,
  }
}

const titles = () => palette.strongResults.value.map(result => result.title)
const modes = () => searches.map(search => search.payload.mode)
function fullQueries() {
  return searches
    .filter(search => search.payload.mode === 'full')
    .map(search => search.payload.query)
}
const lastSearch = () => searches[searches.length - 1]

beforeEach(() => {
  vi.useFakeTimers()
  searches.length = 0
  palette.isOpen.value = true
})

// Незавершённый full оставил бы модульный флаг полёта взведённым для следующего теста.
afterEach(async () => {
  palette.isOpen.value = false
  await nextTick()
  for (const search of searches) {
    if (!search.settled)
      search.resolve(response([]))
  }
  await vi.advanceTimersByTimeAsync(300)
  vi.useRealTimers()
})

describe('command palette search phases', () => {
  it('runs the meaning phase only after words of the same input', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    expect(modes()).toEqual(['words'])

    await vi.advanceTimersByTimeAsync(200)
    expect(modes()).toEqual(['words'])

    searches[0].resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Words hit'])
    expect(palette.meaningSearchStatus.value).toBe('searching')
    expect(modes()).toEqual(['words', 'full'])

    searches[1].resolve(response(['Meaning hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Meaning hit'])
    expect(palette.meaningSearchStatus.value).toBeUndefined()
  })

  it('keeps waiting for meaning when words found nothing', async () => {
    palette.setQuery('webhook signature')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response([]))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual([])
    expect(palette.meaningSearchStatus.value).toBe('searching')

    await vi.advanceTimersByTimeAsync(200)
    searches[1].resolve(response(['Meaning hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Meaning hit'])
    expect(palette.meaningSearchStatus.value).toBeUndefined()
  })

  it('keeps the search layout while the next letter is searched', async () => {
    palette.setQuery('road')
    expect(palette.hasSearchResponse.value).toBe(false)
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response([], 'off'))
    await vi.advanceTimersByTimeAsync(0)
    expect(palette.hasSearchResponse.value).toBe(true)

    palette.setQuery('roadm')
    expect(palette.isSearching.value).toBe(true)
    expect(palette.hasSearchResponse.value).toBe(true)

    palette.clearSearchScope()
    expect(palette.hasSearchResponse.value).toBe(false)
  })

  it('does not search by meaning for a single letter', async () => {
    palette.setQuery('w')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(300)
    expect(modes()).toEqual(['words'])
    expect(palette.meaningSearchStatus.value).toBeUndefined()
  })

  it('skips the meaning phase while the index is not ready', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Words hit'], 'warming'))
    await vi.advanceTimersByTimeAsync(300)
    expect(modes()).toEqual(['words'])
    expect(palette.meaningSearchStatus.value).toBe('warming')
  })

  it('drops a late response of an older input', async () => {
    palette.setQuery('do')
    await vi.advanceTimersByTimeAsync(60)
    palette.setQuery('dock')
    await vi.advanceTimersByTimeAsync(60)
    expect(searches.map(search => search.payload.query)).toEqual([
      'do',
      'dock',
    ])

    searches[1].resolve(response(['Fresh'], 'off'))
    await vi.advanceTimersByTimeAsync(0)
    searches[0].resolve(response(['Stale'], 'off'))
    await vi.advanceTimersByTimeAsync(300)
    expect(titles()).toEqual(['Fresh'])
    expect(modes()).toEqual(['words', 'words'])
  })

  it('cancels pending phases when the palette closes', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    palette.isOpen.value = false
    await nextTick()

    searches[0].resolve(response(['Too late']))
    await vi.advanceTimersByTimeAsync(300)
    expect(titles()).toEqual([])
    expect(modes()).toEqual(['words'])
  })

  it('keeps one meaning request in flight and runs only the latest input after it', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    expect(fullQueries()).toEqual(['docker'])
    const firstFull = lastSearch()

    palette.setQuery('docker c')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    palette.setQuery('docker co')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    expect(fullQueries()).toEqual(['docker'])

    firstFull.resolve(response(['Stale meaning']))
    await vi.advanceTimersByTimeAsync(0)
    expect(fullQueries()).toEqual(['docker', 'docker co'])
    expect(titles()).toEqual(['Words hit'])

    lastSearch().resolve(response(['Meaning hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Meaning hit'])
  })

  it('drops a pending meaning search of an older input', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    const firstFull = lastSearch()

    palette.setQuery('docker c')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    // Следующая буква: её full ещё не сработал, ожидающий относится к прошлому вводу.
    palette.setQuery('docker cx')
    await vi.advanceTimersByTimeAsync(60)

    firstFull.resolve(response([]))
    await vi.advanceTimersByTimeAsync(0)
    expect(fullQueries()).toEqual(['docker'])

    lastSearch().resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    expect(fullQueries()).toEqual(['docker', 'docker cx'])
  })

  it('keeps meaning pending across key presses and clears it when meaning fails', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(palette.meaningSearchStatus.value).toBe('searching')

    palette.setQuery('dockerf')
    expect(palette.meaningSearchStatus.value).toBe('searching')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response(['Words hit']))
    await vi.advanceTimersByTimeAsync(200)
    expect(palette.meaningSearchStatus.value).toBe('searching')
    expect(fullQueries()).toEqual(['dockerf'])

    lastSearch().fail()
    await vi.advanceTimersByTimeAsync(0)
    expect(palette.meaningSearchStatus.value).toBeUndefined()
    expect(titles()).toEqual(['Words hit'])
  })

  it('keeps words results on top when meaning answers', async () => {
    palette.setQuery('docker')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['A', 'B']))
    await vi.advanceTimersByTimeAsync(200)
    const full = response(['A', 'B', 'C'])
    // Смысл считает B сильнее A и находит новый C: показанные A, B остаются на местах.
    full.items = [
      { ...full.items[2], score: 0.99 },
      { ...full.items[1], score: 0.9 },
      { ...full.items[0], score: 0.5 },
    ]
    lastSearch().resolve(full)
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['A', 'B', 'C'])
  })

  it('keeps the shown list while an empty words answer waits for meaning', async () => {
    palette.setQuery('roadmap')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Orbit roadmap']))
    await vi.advanceTimersByTimeAsync(200)
    lastSearch().resolve(response(['Orbit roadmap']))
    await vi.advanceTimersByTimeAsync(0)

    palette.setQuery('roadma')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response([]))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Orbit roadmap'])
    expect(palette.isSearching.value).toBe(true)
    expect(palette.meaningSearchStatus.value).toBe('searching')

    await vi.advanceTimersByTimeAsync(200)
    expect(fullQueries()).toEqual(['roadmap', 'roadma'])
    lastSearch().resolve(response(['Meaning hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Meaning hit'])
    expect(palette.isSearching.value).toBe(false)
    expect(palette.meaningSearchStatus.value).toBeUndefined()
  })

  it('applies the deferred empty words answer when meaning fails', async () => {
    palette.setQuery('roadmap')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Orbit roadmap']))
    await vi.advanceTimersByTimeAsync(200)
    lastSearch().resolve(response(['Orbit roadmap']))
    await vi.advanceTimersByTimeAsync(0)

    palette.setQuery('roadma')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response([]))
    await vi.advanceTimersByTimeAsync(200)
    lastSearch().fail()
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual([])
    expect(palette.isSearching.value).toBe(false)
    expect(palette.meaningSearchStatus.value).toBeUndefined()
  })

  it('applies the empty words answer when meaning is late and meaning after it', async () => {
    palette.setQuery('roadmap')
    await vi.advanceTimersByTimeAsync(60)
    searches[0].resolve(response(['Orbit roadmap']))
    await vi.advanceTimersByTimeAsync(200)
    lastSearch().resolve(response(['Orbit roadmap']))
    await vi.advanceTimersByTimeAsync(0)

    palette.setQuery('roadma')
    await vi.advanceTimersByTimeAsync(60)
    lastSearch().resolve(response([]))
    await vi.advanceTimersByTimeAsync(200)
    expect(titles()).toEqual(['Orbit roadmap'])
    expect(palette.isSearching.value).toBe(true)

    await vi.advanceTimersByTimeAsync(600)
    expect(titles()).toEqual([])
    expect(palette.isSearching.value).toBe(false)
    expect(palette.meaningSearchStatus.value).toBe('searching')

    lastSearch().resolve(response(['Meaning hit']))
    await vi.advanceTimersByTimeAsync(0)
    expect(titles()).toEqual(['Meaning hit'])
    expect(palette.meaningSearchStatus.value).toBeUndefined()
  })
})
