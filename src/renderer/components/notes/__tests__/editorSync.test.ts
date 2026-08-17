import { describe, expect, it } from 'vitest'
import {
  isOwnNoteContentEcho,
  shouldSyncSelectedNoteContent,
} from '../editorSync'

describe('isOwnNoteContentEcho', () => {
  it('does not treat equal content emitted by another note as an echo', () => {
    expect(isOwnNoteContentEcho({ noteId: 1, value: 'same' }, 2, 'same')).toBe(
      false,
    )
  })

  it('matches both note id and content', () => {
    expect(isOwnNoteContentEcho({ noteId: 2, value: 'same' }, 2, 'same')).toBe(
      true,
    )
  })
})

describe('shouldSyncSelectedNoteContent', () => {
  it('returns true when selected note content changes for the same note', () => {
    expect(
      shouldSyncSelectedNoteContent(
        { id: 1, content: 'before' },
        { id: 1, content: 'after' },
      ),
    ).toBe(true)
  })

  it('returns true when selected note changes', () => {
    expect(
      shouldSyncSelectedNoteContent(
        { id: 1, content: 'same' },
        { id: 2, content: 'same' },
      ),
    ).toBe(true)
  })

  it('returns false when note id and content are unchanged', () => {
    expect(
      shouldSyncSelectedNoteContent(
        { id: 1, content: 'same' },
        { id: 1, content: 'same' },
      ),
    ).toBe(false)
  })
})
