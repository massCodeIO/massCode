import { describe, expect, it, vi } from 'vitest'
import {
  getInternalLinkEntityStatus,
  shouldShowInternalLinkWidget,
} from '../decorations'

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
    notes: { getNotesById: vi.fn() },
    snippets: { getSnippetsById: vi.fn() },
  },
}))

describe('shouldShowInternalLinkWidget', () => {
  it('does not render widgets in raw mode', () => {
    expect(
      shouldShowInternalLinkWidget(
        'raw',
        true,
        [{ from: 0, to: 0, empty: true }],
        5,
        20,
      ),
    ).toBe(false)
  })

  it('renders widgets in livePreview and preview when selection is outside the link', () => {
    expect(
      shouldShowInternalLinkWidget(
        'livePreview',
        true,
        [{ from: 0, to: 0, empty: true }],
        5,
        20,
      ),
    ).toBe(true)
    expect(
      shouldShowInternalLinkWidget(
        'preview',
        false,
        [{ from: 0, to: 0, empty: true }],
        5,
        20,
      ),
    ).toBe(true)
  })

  it('shows raw markdown when focused selection is inside the link source range', () => {
    expect(
      shouldShowInternalLinkWidget(
        'livePreview',
        true,
        [{ from: 8, to: 8, empty: true }],
        5,
        20,
      ),
    ).toBe(false)
  })

  it('renders widget when the caret is exactly at the end of the link', () => {
    expect(
      shouldShowInternalLinkWidget(
        'livePreview',
        true,
        [{ from: 20, to: 20, empty: true }],
        5,
        20,
      ),
    ).toBe(true)
  })
})

describe('getInternalLinkEntityStatus', () => {
  it('returns pending when entity is not cached yet', () => {
    expect(getInternalLinkEntityStatus(undefined)).toBe('pending')
  })

  it('returns valid for existing entities', () => {
    expect(
      getInternalLinkEntityStatus({
        exists: true,
        data: {
          id: 1,
          name: 'Snippet',
          type: 'snippet',
          folder: null,
          isDeleted: 0,
        },
      }),
    ).toBe('valid')
  })

  it('returns broken for missing entities', () => {
    expect(getInternalLinkEntityStatus({ exists: false })).toBe('broken')
  })
})
