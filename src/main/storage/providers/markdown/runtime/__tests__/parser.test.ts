import type { MarkdownSnippet } from '../types'
import { describe, expect, it } from 'vitest'
import {
  parseBodyFragments,
  serializeSnippet,
  splitFrontmatter,
} from '../parser'

function createSnippet(value: string): MarkdownSnippet {
  return {
    contents: [
      {
        id: 1,
        label: 'Fragment 1',
        language: 'plain_text',
        value,
      },
    ],
    createdAt: 1,
    description: null,
    filePath: '.masscode/inbox/Test.md',
    folderId: null,
    id: 1,
    isDeleted: 0,
    isFavorites: 0,
    name: 'Test',
    tags: [],
    updatedAt: 1,
  }
}

describe('parser snippet content roundtrip', () => {
  it('preserves content with inner fenced code blocks', () => {
    const input = 'line 1\n```\ninner fence\n```\nline 2\nline 3'
    const serialized = serializeSnippet(createSnippet(input))
    const { body } = splitFrontmatter(serialized)
    const parsed = parseBodyFragments(body)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].value).toBe(input)
  })
})
