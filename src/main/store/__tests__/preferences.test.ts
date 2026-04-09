import { afterEach, describe, expect, it, vi } from 'vitest'

type State = Record<string, any>

let persistedStateByName: Record<string, State> = {}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mergeState(base: State, patch: State): State {
  const result = clone(base)

  for (const [key, value] of Object.entries(patch)) {
    const current = result[key]

    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && current
      && typeof current === 'object'
      && !Array.isArray(current)
    ) {
      result[key] = mergeState(current, value)
      continue
    }

    result[key] = clone(value)
  }

  return result
}

function getByPath(state: State, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, segment) => {
    if (!acc || typeof acc !== 'object') {
      return undefined
    }

    return (acc as State)[segment]
  }, state)
}

function setByPath(state: State, key: string, value: unknown): void {
  const segments = key.split('.')
  let cursor = state

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const next = cursor[segment]

    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {}
    }

    cursor = cursor[segment] as State
  }

  cursor[segments[segments.length - 1]] = value
}

vi.mock('electron-store', () => {
  class MockStore {
    private state: State

    constructor(options?: { defaults?: State, name?: string }) {
      const persistedState = options?.name
        ? persistedStateByName[options.name] || {}
        : {}

      this.state = mergeState(options?.defaults || {}, persistedState)
    }

    get(key?: string): unknown {
      if (!key) {
        return this.state
      }

      return getByPath(this.state, key)
    }

    set(key: string | State, value?: unknown): void {
      if (typeof key === 'string') {
        setByPath(this.state, key, value)
        return
      }

      this.state = mergeState(this.state, key)
    }

    clear(): void {
      this.state = {}
    }

    get store(): State {
      return this.state
    }

    set store(value: State) {
      this.state = clone(value)
    }
  }

  return { default: MockStore }
})

afterEach(() => {
  persistedStateByName = {}
  vi.resetModules()
})

describe('preferences store sanitization', () => {
  it('migrates legacy keys into grouped preferences schema and prunes stale values', async () => {
    persistedStateByName.preferences = {
      storagePath: '/custom-storage',
      apiPort: 9876,
      language: 'ru_RU',
      theme: 'dark',
      legacyRootFlag: true,
      editor: {
        fontSize: 18,
        legacyEditorFlag: true,
      },
      notesEditor: {
        fontSize: 16,
        legacyNotesEditorFlag: true,
      },
      storage: {
        vaultPath: '/custom-vault',
        legacyStorageFlag: true,
      },
      markdown: {
        scale: 1.25,
        legacyMarkdownFlag: true,
      },
    }

    const { default: preferences } = await import('../module/preferences')

    expect(preferences.get('storage.rootPath' as any)).toBe('/custom-storage')
    expect(preferences.get('api.port' as any)).toBe(9876)
    expect(preferences.get('localization.locale' as any)).toBe('ru_RU')
    expect(preferences.get('appearance.theme' as any)).toBe('dark')
    expect(preferences.get('editor.code.fontSize' as any)).toBe(18)
    expect(preferences.get('editor.notes.fontSize' as any)).toBe(16)
    expect(preferences.get('storage.vaultPath' as any)).toBe('/custom-vault')
    expect(preferences.get('editor.markdown.scale' as any)).toBe(1.25)

    expect(preferences.get('legacyRootFlag' as any)).toBeUndefined()
    expect(preferences.get('storagePath' as any)).toBeUndefined()
    expect(preferences.get('apiPort' as any)).toBeUndefined()
    expect(preferences.get('language' as any)).toBeUndefined()
    expect(preferences.get('theme' as any)).toBeUndefined()
    expect(preferences.get('editor.fontSize' as any)).toBeUndefined()
    expect(
      preferences.get('editor.code.legacyEditorFlag' as any),
    ).toBeUndefined()
    expect(preferences.get('notesEditor' as any)).toBeUndefined()
    expect(
      preferences.get('editor.notes.legacyNotesEditorFlag' as any),
    ).toBeUndefined()
    expect(preferences.get('storage.legacyStorageFlag' as any)).toBeUndefined()
    expect(preferences.get('markdown' as any)).toBeUndefined()
    expect(
      preferences.get('editor.markdown.legacyMarkdownFlag' as any),
    ).toBeUndefined()
  })
})

describe('app store sanitization', () => {
  it('migrates legacy keys into grouped app schema and prunes stale values', async () => {
    persistedStateByName.app = {
      bounds: { width: 1200, height: 800 },
      state: {
        snippetId: 10,
        folderId: 5,
        codeLayoutMode: 'all-panels',
        legacyStateFlag: true,
      },
      compactListMode: true,
      sizes: {
        tagsListHeight: 30,
        layout: [15, 20, 65],
        codeListLayout: [35, 65],
        notesLayout: [10, 25, 65],
        notesLayoutWithoutSidebar: [28, 72],
        notesTagsListHeight: 40,
        legacySizeFlag: true,
      },
      notesState: {
        noteId: 20,
        folderId: 7,
        isSidebarHidden: true,
        isListHidden: false,
        legacyNotesStateFlag: true,
      },
      notesEditorMode: 'preview',
      nextDonateNotification: 1_700_000_000_000,
      lastNotifiedUpdateVersion: '4.7.1',
      legacyRootFlag: true,
    }

    const { default: app } = await import('../module/app')

    expect(app.get('window.bounds' as any)).toEqual({
      width: 1200,
      height: 800,
    })
    expect(app.get('code.selection' as any)).toEqual({
      snippetId: 10,
      folderId: 5,
    })
    expect(app.get('code.layout.mode' as any)).toBe('all-panels')
    expect(app.get('ui.compactListMode' as any)).toBe(true)
    expect(app.get('code.layout.tagsListHeight' as any)).toBe(200)
    expect(app.get('code.layout.threePanel' as any)).toEqual([15, 20, 65])
    expect(app.get('code.layout.twoPanel' as any)).toBeUndefined()
    expect(app.get('notes.selection' as any)).toEqual({
      noteId: 20,
      folderId: 7,
    })
    expect(app.get('notes.editorMode' as any)).toBe('preview')
    expect(app.get('notes.layout.mode' as any)).toBe('list-editor')
    expect(app.get('notes.layout.threePanel' as any)).toEqual([10, 25, 65])
    expect(app.get('notes.layout.twoPanel' as any)).toBeUndefined()
    expect(app.get('notes.layout.tagsListHeight' as any)).toBe(200)
    expect(app.get('notifications.nextDonateAt' as any)).toBe(
      1_700_000_000_000,
    )
    expect(app.get('notifications.lastNotifiedUpdateVersion' as any)).toBe(
      '4.7.1',
    )

    expect(app.get('bounds' as any)).toBeUndefined()
    expect(app.get('state' as any)).toBeUndefined()
    expect(app.get('compactListMode' as any)).toBeUndefined()
    expect(app.get('sizes' as any)).toBeUndefined()
    expect(app.get('notesState' as any)).toBeUndefined()
    expect(app.get('notesEditorMode' as any)).toBeUndefined()
    expect(app.get('nextDonateNotification' as any)).toBeUndefined()
    expect(app.get('lastNotifiedUpdateVersion' as any)).toBeUndefined()
    expect(app.get('legacyRootFlag' as any)).toBeUndefined()
    expect(app.get('code.layout.legacySizeFlag' as any)).toBeUndefined()
    expect(app.get('code.selection.legacyStateFlag' as any)).toBeUndefined()
    expect(
      app.get('notes.selection.legacyNotesStateFlag' as any),
    ).toBeUndefined()
  })

  it('adds sanitized defaults for notes dashboard widget visibility', async () => {
    persistedStateByName.app = {
      notes: {
        dashboard: {
          widgets: {
            stats: false,
            recent: false,
            topLinked: true,
            garbage: 'bad',
          },
        },
      },
    }

    const { default: app } = await import('../module/app')

    expect(app.get('notes.dashboard.widgets' as any)).toEqual({
      stats: false,
      activityHeatmap: true,
      recent: false,
      graphPreview: true,
      topLinked: true,
    })
    expect(app.get('notes.dashboard.widgets.garbage' as any)).toBeUndefined()
  })

  it('keeps persisted notes route when it is a valid string', async () => {
    persistedStateByName.app = {
      notes: {
        route: 'notes-space/dashboard',
      },
    }

    const { default: app } = await import('../module/app')

    expect(app.get('notes.route' as any)).toBe('notes-space/dashboard')
  })
})
