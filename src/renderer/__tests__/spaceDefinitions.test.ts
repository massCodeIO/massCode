import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadSpaceDefinitions(savedNotesRoute?: string) {
  vi.resetModules()

  vi.doMock('@/electron', () => ({
    i18n: {
      t: (value: string) => value,
    },
    store: {
      app: {
        get: vi.fn((key: string) => {
          if (key === 'notes.route') {
            return savedNotesRoute
          }

          return undefined
        }),
      },
    },
  }))

  vi.doMock('@/router', () => ({
    RouterName: {
      main: 'main',
      notesSpace: 'notes-space',
      notesDashboard: 'notes-space/dashboard',
      notesGraph: 'notes-space/graph',
      mathNotebook: 'math-notebook',
      devtools: 'devtools',
    },
    router: {
      currentRoute: {
        value: {
          name: null,
        },
      },
    },
  }))

  return import('../spaceDefinitions')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('spaceDefinitions', () => {
  it('uses saved notes sub-route as Notes space target', async () => {
    const { getSpaceDefinitions } = await loadSpaceDefinitions(
      'notes-space/dashboard',
    )

    const notesSpace = getSpaceDefinitions().find(
      space => space.id === 'notes',
    )

    expect(notesSpace?.to).toEqual({ name: 'notes-space/dashboard' })
  })

  it('falls back to base notes route for invalid saved route', async () => {
    const { getSpaceDefinitions } = await loadSpaceDefinitions('garbage')

    const notesSpace = getSpaceDefinitions().find(
      space => space.id === 'notes',
    )

    expect(notesSpace?.to).toEqual({ name: 'notes-space' })
  })
})
