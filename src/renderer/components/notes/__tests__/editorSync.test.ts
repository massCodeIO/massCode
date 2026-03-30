import { describe, expect, it } from 'vitest'
import { shouldSyncSelectedNoteContent } from '../editorSync'

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
