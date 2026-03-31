import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  buildInternalLinkInsertChange,
  findInternalLinkTriggerRange,
  isInternalLinkPickerEnabled,
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

describe('buildInternalLinkInsertChange', () => {
  it('replaces only the original trigger range', () => {
    expect(
      buildInternalLinkInsertChange(
        { from: 10, to: 12 },
        { type: 'note', id: 15, label: 'Array ] draft' },
      ),
    ).toEqual({
      from: 10,
      to: 12,
      insert: '[[note:15|Array \\] draft]]',
    })
  })
})
