import type { InternalLinkPickerItem } from '../trigger'
import { EditorState } from '@codemirror/state'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  buildInternalLinkInsertChange,
  createInternalLinksTrigger,
  findInternalLinkSearchMatch,
  findInternalLinkTriggerRange,
  getInternalLinksPickerAnchorFromCoords,
  getInternalLinkTokenState,
  handleInternalLinksPickerKey,
  internalLinksPickerState,
  isInternalLinkPickerEnabled,
  pickShortestUniqueInsertTarget,
  selectInternalLinksPickerItem,
  setInternalLinksPickerQuery,
  shouldOpenInternalLinksPicker,
} from '../trigger'

vi.mock('@/electron', () => ({
  i18n: {
    t: vi.fn((key: string) => key),
  },
  ipc: {},
  store: {
    preferences: {
      get: vi.fn(() => 4321),
    },
  },
}))

vi.mock('@/services/api', () => ({
  api: {
    httpFolders: { getHttpFolders: vi.fn() },
    httpRequests: { getHttpRequests: vi.fn() },
    notes: { getNotes: vi.fn() },
    noteFolders: { getNoteFolders: vi.fn() },
    snippets: { getSnippets: vi.fn() },
  },
}))

vi.mock('@/composables', () => ({
  useApp: () => ({
    highlightedFolderIds: ref(new Set<number>()),
    highlightedSnippetIds: ref(new Set<number>()),
    focusedFolderId: ref<number | undefined>(),
    focusedSnippetId: ref<number | undefined>(),
    state: {},
  }),
  useFolders: () => ({
    clearFolderSelection: vi.fn(),
    getFolders: vi.fn(),
    selectFolder: vi.fn(),
  }),
  useNoteFolders: () => ({
    clearFolderSelection: vi.fn(),
    getNoteFolders: vi.fn(),
    selectNoteFolder: vi.fn(),
  }),
  useNotes: () => ({
    getNotes: vi.fn(),
    selectNote: vi.fn(),
  }),
  useNotesApp: () => ({
    focusedNoteId: ref<number | undefined>(),
    highlightedFolderIds: ref(new Set<number>()),
    highlightedNoteIds: ref(new Set<number>()),
    notesState: {},
  }),
  useSnippets: () => ({
    getSnippets: vi.fn(),
    selectSnippet: vi.fn(),
  }),
}))

vi.mock('@/router', () => ({
  RouterName: {
    main: 'main',
    notesSpace: 'notes-space',
  },
  router: {
    currentRoute: ref({ name: 'main' }),
    push: vi.fn(),
  },
}))

describe('isInternalLinkPickerEnabled', () => {
  it('enables picker only in editable raw and livePreview modes', () => {
    expect(isInternalLinkPickerEnabled('raw', true)).toBe(true)
    expect(isInternalLinkPickerEnabled('livePreview', true)).toBe(true)
    expect(isInternalLinkPickerEnabled('preview', true)).toBe(false)
    expect(isInternalLinkPickerEnabled('livePreview', false)).toBe(false)
  })
})

describe('findInternalLinkTriggerRange', () => {
  it('finds the trigger when cursor is right after [[', () => {
    expect(findInternalLinkTriggerRange('Hello [[', 8)).toEqual({
      from: 6,
      to: 8,
    })
  })

  it('returns null when trigger is not directly before the cursor', () => {
    expect(findInternalLinkTriggerRange('Hello [[x', 9)).toBeNull()
    expect(findInternalLinkTriggerRange('Hello [', 7)).toBeNull()
  })
})

describe('findInternalLinkSearchMatch', () => {
  it('uses everything after [[ on the current line as query', () => {
    expect(findInternalLinkSearchMatch('Hello [[doc link', 16)).toEqual({
      anchor: 16,
      from: 6,
      query: 'doc link',
      to: 16,
    })
  })

  it('returns null after the user starts typing an alias via a pipe', () => {
    expect(
      findInternalLinkSearchMatch('Hello [[doc link|Alias', 22),
    ).toBeNull()
  })

  it('returns null when query already contains a closing bracket', () => {
    expect(findInternalLinkSearchMatch('Hello [[doc] link', 17)).toBeNull()
  })

  it('treats editing inside a completed obsidian-style target as search mode', () => {
    expect(findInternalLinkSearchMatch('Hello [[Doc]] tail', 11)).toEqual({
      anchor: 11,
      from: 6,
      query: 'Doc',
      to: 13,
    })
  })

  it('returns null inside an existing legacy stored internal link payload', () => {
    expect(
      findInternalLinkSearchMatch('Hello [[snippet:56|Doc label', 29),
    ).toBeNull()
    expect(
      findInternalLinkSearchMatch('Hello [[note:12|Doc label', 26),
    ).toBeNull()
    expect(
      findInternalLinkSearchMatch('Hello [[http-request:8|Create snippet', 37),
    ).toBeNull()
  })
})

describe('getInternalLinkTokenState', () => {
  it('keeps completed obsidian-style link editable in target segment', () => {
    const text = 'Hello [[Repository Pattern]] tail'
    const linkStart = text.indexOf('[[') + 2
    const linkEnd = text.indexOf(']]')

    expect(getInternalLinkTokenState(text, linkStart)).toEqual({
      kind: 'search',
      match: {
        anchor: linkStart,
        from: text.indexOf('[['),
        query: 'Repository Pattern',
        to: linkEnd + 2,
      },
    })
    expect(getInternalLinkTokenState(text, linkStart + 5)).toEqual({
      kind: 'search',
      match: {
        anchor: linkStart + 5,
        from: text.indexOf('[['),
        query: 'Repository Pattern',
        to: linkEnd + 2,
      },
    })
    expect(getInternalLinkTokenState(text, linkEnd)).toEqual({
      kind: 'search',
      match: {
        anchor: linkEnd,
        from: text.indexOf('[['),
        query: 'Repository Pattern',
        to: linkEnd + 2,
      },
    })
  })

  it('keeps alias segment of a completed link out of search mode', () => {
    expect(
      getInternalLinkTokenState('Hello [[Repository|Shown]] tail', 22),
    ).toEqual({
      kind: 'stored_link',
    })
  })
})

describe('shouldOpenInternalLinksPicker', () => {
  it('opens only on document changes when the picker is currently closed', () => {
    expect(
      shouldOpenInternalLinksPicker({
        docChanged: true,
        isOpen: false,
        selectionSet: false,
      }),
    ).toBe(true)

    expect(
      shouldOpenInternalLinksPicker({
        docChanged: false,
        isOpen: false,
        selectionSet: true,
      }),
    ).toBe(false)

    expect(
      shouldOpenInternalLinksPicker({
        docChanged: false,
        isOpen: true,
        selectionSet: true,
      }),
    ).toBe(true)
  })
})

describe('getInternalLinksPickerAnchorFromCoords', () => {
  it('anchors the popup below the current text line', () => {
    expect(
      getInternalLinksPickerAnchorFromCoords({
        bottom: 96,
        left: 144,
      }),
    ).toEqual({
      left: 144,
      top: 96,
    })
  })
})

describe('handleInternalLinksPickerKey', () => {
  it('jumps past matches to Plan Note without creating, leaving Tab alone', () => {
    const plan = vi.fn()
    internalLinksPickerState.isOpen = true
    internalLinksPickerState.items = Array.from({ length: 50 }, (_, id) => ({
      id,
      name: String(id),
      locationLabel: '',
      type: 'note' as const,
    }))
    internalLinksPickerState.activeIndex = 0
    internalLinksPickerState.plan = plan
    expect(handleInternalLinksPickerKey('Tab')).toBe(false)
    expect(handleInternalLinksPickerKey('Mod-Enter')).toBe(true)
    expect(internalLinksPickerState.activeIndex).toBe(50)
    expect(plan).not.toHaveBeenCalled()
    handleInternalLinksPickerKey('Enter')
    expect(plan).toHaveBeenCalledExactlyOnceWith('note')
    handleInternalLinksPickerKey('Escape')
    expect(handleInternalLinksPickerKey('Mod-Enter')).toBe(false)
  })

  it.each([0, 2])(
    'navigates results and Plan actions with Enter (%s results)',
    (resultCount) => {
      const plan = vi.fn()
      internalLinksPickerState.isOpen = true
      internalLinksPickerState.activeIndex = resultCount ? resultCount - 1 : 0
      internalLinksPickerState.items = Array.from(
        { length: resultCount },
        (_, id) => ({
          id,
          name: String(id),
          locationLabel: '',
          type: 'note' as const,
        }),
      )
      internalLinksPickerState.plan = plan
      if (resultCount)
        handleInternalLinksPickerKey('ArrowDown')
      for (const [offset, type] of [
        'note',
        'snippet',
        'http-request',
      ].entries()) {
        expect(internalLinksPickerState.activeIndex).toBe(resultCount + offset)
        handleInternalLinksPickerKey('Enter')
        expect(plan).toHaveBeenLastCalledWith(type)
        handleInternalLinksPickerKey('ArrowDown')
      }
      expect(internalLinksPickerState.activeIndex).toBe(0)
      handleInternalLinksPickerKey('ArrowUp')
      expect(internalLinksPickerState.activeIndex).toBe(resultCount + 2)
      handleInternalLinksPickerKey('Escape')
      expect(internalLinksPickerState.isOpen).toBe(false)
      expect(internalLinksPickerState.plan).toBeNull()
    },
  )

  it('preserves the selected action when search results arrive', async () => {
    const { api } = await import('@/services/api')
    for (const get of [
      api.snippets.getSnippets,
      api.notes.getNotes,
      api.noteFolders.getNoteFolders,
      api.httpRequests.getHttpRequests,
      api.httpFolders.getHttpFolders,
    ])
      vi.mocked(get).mockResolvedValue({ data: [] } as never)
    vi.mocked(api.notes.getNotes).mockResolvedValue({
      data: [{ id: 7, name: 'Match', folder: null, isDeleted: 0 }],
    } as never)
    internalLinksPickerState.isOpen = true
    internalLinksPickerState.items = []
    internalLinksPickerState.activeIndex = 0
    internalLinksPickerState.plan = vi.fn()
    const pending = setInternalLinksPickerQuery('Match')
    handleInternalLinksPickerKey('ArrowUp')
    await pending
    expect(internalLinksPickerState.items).toHaveLength(1)
    expect(internalLinksPickerState.activeIndex).toBe(3)
    handleInternalLinksPickerKey('Enter')
    expect(internalLinksPickerState.plan).toHaveBeenCalledWith('http-request')
    handleInternalLinksPickerKey('Escape')
  })
  it('moves active selection with arrow keys', () => {
    internalLinksPickerState.isOpen = true
    internalLinksPickerState.activeIndex = 0
    internalLinksPickerState.items = [
      { id: 1, locationLabel: 'A', name: 'A', type: 'snippet' },
      { id: 2, locationLabel: 'B', name: 'B', type: 'note' },
    ]

    expect(handleInternalLinksPickerKey('ArrowDown')).toBe(true)
    expect(internalLinksPickerState.activeIndex).toBe(1)
    expect(handleInternalLinksPickerKey('ArrowUp')).toBe(true)
    expect(internalLinksPickerState.activeIndex).toBe(0)
  })
})

describe('buildInternalLinkInsertChange', () => {
  it('replaces only the original trigger range with exact obsidian format', () => {
    expect(
      buildInternalLinkInsertChange(
        { anchor: 16, from: 10, query: 'Repo', to: 16 },
        'Repository Pattern with Cache',
      ),
    ).toEqual({
      from: 10,
      to: 16,
      insert: '[[Repository Pattern with Cache]]',
    })
  })
})

describe('pickShortestUniqueInsertTarget', () => {
  it.each([undefined, 'Projects/Active'])(
    'uses a typed note target for a cross-type name collision in %s',
    (folderPath) => {
      const selected: InternalLinkPickerItem = {
        folderPath,
        id: 7,
        locationLabel: '',
        name: 'Hello',
        type: 'note',
      }
      expect(
        pickShortestUniqueInsertTarget(selected, [
          selected,
          { id: 8, locationLabel: '', name: 'hello', type: 'snippet' },
        ]),
      ).toBe('note:7')
    },
  )

  it('returns bare name for snippets regardless of duplicates', () => {
    const selected = {
      folderPath: 'A',
      id: 1,
      locationLabel: 'A',
      name: 'Shared',
      type: 'snippet' as const,
    }
    const items = [
      selected,
      {
        folderPath: 'B',
        id: 2,
        locationLabel: 'B',
        name: 'Shared',
        type: 'note' as const,
      },
    ]

    expect(pickShortestUniqueInsertTarget(selected, items)).toBe('Shared')
  })

  it('returns bare name when no other note shares the same name', () => {
    const selected = {
      folderPath: 'Projects',
      id: 1,
      locationLabel: 'Projects',
      name: 'Repository Pattern',
      type: 'note' as const,
    }
    const items = [
      selected,
      {
        folderPath: 'Other',
        id: 2,
        locationLabel: 'Other',
        name: 'Other Note',
        type: 'note' as const,
      },
    ]

    expect(pickShortestUniqueInsertTarget(selected, items)).toBe(
      'Repository Pattern',
    )
  })

  it('returns full folder path when another note shares the same name', () => {
    const selected = {
      folderPath: 'Projects/Active',
      id: 1,
      locationLabel: 'Active',
      name: 'Repository Pattern',
      type: 'note' as const,
    }
    const items = [
      selected,
      {
        folderPath: 'Archive',
        id: 2,
        locationLabel: 'Archive',
        name: 'Repository Pattern',
        type: 'note' as const,
      },
    ]

    expect(pickShortestUniqueInsertTarget(selected, items)).toBe(
      'Projects/Active/Repository Pattern',
    )
  })

  it('returns full folder path when another HTTP request shares the same name', () => {
    const selected = {
      folderPath: 'API',
      id: 1,
      locationLabel: 'API',
      name: 'Create snippet',
      type: 'http-request' as const,
    }
    const items = [
      selected,
      {
        folderPath: 'Admin',
        id: 2,
        locationLabel: 'Admin',
        name: 'Create snippet',
        type: 'http-request' as const,
      },
    ]

    expect(pickShortestUniqueInsertTarget(selected, items)).toBe(
      'API/Create snippet',
    )
  })

  it('matches duplicate names case-insensitively', () => {
    const selected = {
      folderPath: 'Projects',
      id: 1,
      locationLabel: 'Projects',
      name: 'Repository Pattern',
      type: 'note' as const,
    }
    const items = [
      selected,
      {
        folderPath: 'Archive',
        id: 2,
        locationLabel: 'Archive',
        name: 'repository pattern',
        type: 'note' as const,
      },
    ]

    expect(pickShortestUniqueInsertTarget(selected, items)).toBe(
      'Projects/Repository Pattern',
    )
  })

  it('returns bare name for a root-level note even with duplicates', () => {
    const selected = {
      id: 1,
      locationLabel: 'inbox',
      name: 'Shared',
      type: 'note' as const,
    }
    const items = [
      selected,
      {
        folderPath: 'Folder',
        id: 2,
        locationLabel: 'Folder',
        name: 'Shared',
        type: 'note' as const,
      },
    ]

    expect(pickShortestUniqueInsertTarget(selected, items)).toBe('Shared')
  })
})

describe('selectInternalLinksPickerItem', () => {
  it.each([
    {
      folderPath: undefined,
      otherName: 'Hello',
      otherType: 'snippet',
      expected: '[[note:7|Hello]]',
    },
    {
      folderPath: 'Projects',
      otherName: 'hello',
      otherType: 'snippet',
      expected: '[[note:7|Hello]]',
    },
    {
      folderPath: undefined,
      otherName: 'hello',
      otherType: 'http-request',
      expected: '[[note:7|Hello]]',
    },
    {
      folderPath: undefined,
      otherName: 'Other',
      otherType: 'snippet',
      expected: '[[Hello]]',
    },
    {
      folderPath: 'Projects',
      otherName: 'Other',
      otherType: 'snippet',
      expected: '[[Hello]]',
    },
    {
      folderPath: 'Projects',
      otherName: 'hello',
      otherType: 'note',
      expected: '[[Projects/Hello]]',
    },
  ] as const)(
    'inserts $expected for a note in $folderPath alongside $otherType $otherName',
    async ({ folderPath, otherName, otherType, expected }) => {
      const { api } = await import('@/services/api')
      for (const get of [
        api.snippets.getSnippets,
        api.notes.getNotes,
        api.noteFolders.getNoteFolders,
        api.httpRequests.getHttpRequests,
        api.httpFolders.getHttpFolders,
      ])
        vi.mocked(get).mockResolvedValue({ data: [] } as never)

      let state = EditorState.create({ doc: 'Before  after' })
      let plugin: { update: (value: unknown) => void, destroy: () => void }
      const view = {
        get state() {
          return state
        },
        requestMeasure: vi.fn(),
        focus: vi.fn(),
        dispatch(spec: Parameters<typeof state.update>[0]) {
          const tr = state.update(spec)
          state = tr.state
          plugin.update({
            view,
            docChanged: tr.docChanged,
            selectionSet: tr.selection !== undefined,
            changes: tr.changes,
          })
        },
      }
      const extension = createInternalLinksTrigger({
        mode: 'raw',
        editable: true,
      })
      plugin = (
        extension[0] as { create: (view: unknown) => typeof plugin }
      ).create(view)
      try {
        view.dispatch({
          changes: { from: 7, insert: '[[Hel' },
          selection: { anchor: 12 },
        })
        await setInternalLinksPickerQuery('Hel')
        internalLinksPickerState.items = [
          {
            id: 8,
            name: otherName,
            type: otherType,
            locationLabel: '',
            folderPath: 'Archive',
          },
          { id: 7, name: 'Hello', type: 'note', locationLabel: '', folderPath },
        ]
        selectInternalLinksPickerItem(1)
        expect(state.doc.toString()).toBe(`Before ${expected} after`)
        expect(state.selection.main.head).toBe(7 + expected.length)
        expect(internalLinksPickerState.isOpen).toBe(false)
        expect(view.focus).toHaveBeenCalledOnce()
      }
      finally {
        plugin.destroy()
      }
    },
  )
})

describe('planned occurrence owner actions', () => {
  it.each([1, 22])(
    'captures only the chosen complete occurrence in owner %s and maps later edits',
    async (id) => {
      const { EditorState } = await import('@codemirror/state')
      const { createInternalLinksTrigger, getPlannedLinkActions }
        = await import('../trigger')
      const { findInternalLinks } = await import('../parser')
      const raw = '[[masscode:planned:note|Later]]'
      let state = EditorState.create({ doc: `${raw} ${raw}` })
      let plugin: { update: (value: unknown) => void, destroy: () => void }
      const view = {
        get state() {
          return state
        },
        dom: { inert: false },
        requestMeasure: vi.fn(),
        focus: vi.fn(),
        dispatch(spec: Parameters<typeof state.update>[0]) {
          const tr = state.update(spec)
          state = tr.state
          plugin.update({
            view,
            docChanged: tr.docChanged,
            selectionSet: false,
            changes: tr.changes,
          })
        },
      }
      const create = vi.fn()
      const extension = createInternalLinksTrigger({
        mode: 'livePreview',
        editable: true,
        sourceIdentity: () => ({ id, generation: 0 }),
        activatePlannedLink: create,
      })
      plugin = (
        extension[0] as { create: (view: unknown) => typeof plugin }
      ).create(view)
      const actions = getPlannedLinkActions(
        view as never,
        findInternalLinks(state.doc.toString())[1]!,
      )!
      actions.create()
      const captured = create.mock.calls[0]![0]
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: id }),
        'note',
        'Later',
      )
      view.dispatch({ changes: { from: 0, insert: 'prefix ' } })
      captured.insert('[[note:9|Existing]]')
      expect(state.doc.toString()).toBe(`prefix ${raw} [[note:9|Existing]]`)
      plugin.destroy()
      expect(captured.valid()).toBe(false)
      actions.create()
      expect(create).toHaveBeenCalledTimes(1)
    },
  )
  it('treats the complete planned token as stored at every target caret and uses typed IDs for reserved real names', () => {
    const token = '[[masscode:planned:note|Later]]'
    expect(getInternalLinkTokenState(token, 5)).toEqual({
      kind: 'stored_link',
    })
    expect(getInternalLinkTokenState('[[masscode:planned:note]]', 5)).toEqual({
      kind: 'stored_link',
    })
    expect(
      pickShortestUniqueInsertTarget(
        {
          id: 9,
          name: 'masscode:planned:note',
          type: 'snippet',
          locationLabel: '',
        },
        [],
      ),
    ).toBe('snippet:9')
  })
})
