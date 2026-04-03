import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  buildInternalLinkInsertChange,
  findInternalLinkSearchMatch,
  findInternalLinkTriggerRange,
  getInternalLinksPickerAnchorFromCoords,
  getInternalLinkTokenState,
  handleInternalLinksPickerKey,
  internalLinksPickerState,
  isInternalLinkPickerEnabled,
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
    notes: { getNotes: vi.fn() },
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
        { type: 'note', id: 15, label: 'Repository Pattern with Cache' },
      ),
    ).toEqual({
      from: 10,
      to: 16,
      insert: '[[Repository Pattern with Cache]]',
    })
  })
})
