import type { WorkspaceChange } from '~/shared/aiWorkspace'
import { describe, expect, it } from 'vitest'
import { workspaceReviewFields } from './workspaceReview'

function change(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  space: 'code' | 'notes' = 'code',
): WorkspaceChange {
  return {
    before: JSON.stringify(before),
    after: JSON.stringify(after),
    name: 'Example',
    operation: { action: 'update', kind: 'item', space, fields: {} },
  }
}

describe('workspace review snapshots', () => {
  it('preserves tag boundaries and literal markup without comma serialization', () => {
    const fields = workspaceReviewFields(
      change({ tags: ['a,b', '<b>tag</b>'] }, { tags: ['a,b', 'new'] }),
      'Root',
    )
    expect(fields[0]?.beforeTags).toEqual(['a,b', '<b>tag</b>'])
    expect(fields[0]?.afterTags).toEqual(['a,b', 'new'])
  })
  it('compares newly created content against an empty document', () => {
    const fields = workspaceReviewFields(
      change({}, { content: 'hello' }),
      'Root',
    )
    expect(fields[0]).toMatchObject({
      before: '',
      after: 'hello',
      language: 'plain',
      diff: true,
    })
  })
  it('uses snapshot language and falls back to markdown for notes', () => {
    expect(
      workspaceReviewFields(
        change(
          { content: 'old', language: 'typescript' },
          { content: 'new', language: 'typescript' },
        ),
        'Root',
      )[0]?.language,
    ).toBe('typescript')
    expect(
      workspaceReviewFields(
        change({ content: 'old' }, { content: 'new' }, 'notes'),
        'Root',
      )[0]?.language,
    ).toBe('markdown')
  })
  it('omits internal ids and unchanged fields while labeling a root move', () => {
    const fields = workspaceReviewFields(
      change(
        { contentId: 1, folderId: 2, name: 'same' },
        { contentId: 2, folderId: null, name: 'same' },
      ),
      'Root',
    )
    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({
      key: 'folderId',
      before: '2',
      after: 'Root',
      diff: false,
    })
  })
})
