import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadRouter() {
  vi.resetModules()
  vi.stubGlobal('location', {
    hash: '',
    host: 'localhost',
    pathname: '/',
    search: '',
  })
  vi.stubGlobal('window', {
    location,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    history: {
      length: 1,
      pushState: vi.fn(),
      replaceState: vi.fn(),
      state: null,
    },
  })
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      relList: {
        supports: vi.fn(() => false),
      },
    })),
    querySelector: vi.fn(() => null),
  })

  return import('../index')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('notes routes', () => {
  it('resolves dashboard as a child Notes route', async () => {
    const { RouterName, router } = await loadRouter()
    const result = router.resolve({ name: RouterName.notesDashboard as any })

    expect(result.path).toBe('/notes/dashboard')
    expect(result.matched.map(record => record.name)).toEqual([
      RouterName.notesSpace,
      RouterName.notesDashboard,
    ])
  })

  it('resolves graph as a child Notes route', async () => {
    const { RouterName, router } = await loadRouter()
    const result = router.resolve({ name: RouterName.notesGraph as any })

    expect(result.path).toBe('/notes/graph')
    expect(result.matched.map(record => record.name)).toEqual([
      RouterName.notesSpace,
      RouterName.notesGraph,
    ])
  })
})
