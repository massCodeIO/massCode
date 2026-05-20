import type { MarkdownSnippet } from '../types'
import { describe, expect, it } from 'vitest'
import {
  parseBodyFragments,
  parseBodyFragmentsWithMetadata,
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

describe('legacy snippet fence recovery', () => {
  it('recovers a legacy triple-backtick wrapper with inner fenced blocks', () => {
    const body = [
      '## Fragment: Fragment 1',
      '```markdown',
      'Before',
      '```',
      'inner block',
      '```',
      'After',
      '```',
      '',
    ].join('\n')

    const result = parseBodyFragmentsWithMetadata(body, [
      {
        id: 1,
        label: 'Fragment 1',
        language: 'markdown',
      },
    ])

    expect(result.legacyRecovery).toBe('recovered')
    expect(result.fragments).toHaveLength(1)
    expect(result.fragments[0].value).toBe(
      ['Before', '```', 'inner block', '```', 'After'].join('\n'),
    )
  })

  it('uses declared fragments instead of user text that looks like a fragment heading', () => {
    const body = [
      '## Fragment: Fragment 1',
      '```markdown',
      'Intro',
      '## Fragment: Fragment 2',
      '```plain_text',
      'not a fragment boundary',
      '```',
      'Outro',
      '```',
      '',
      '## Fragment: Fragment 2',
      '```javascript',
      'console.log("second")',
      '```',
      '',
    ].join('\n')

    const result = parseBodyFragmentsWithMetadata(body, [
      {
        id: 1,
        label: 'Fragment 1',
        language: 'markdown',
      },
      {
        id: 2,
        label: 'Fragment 2',
        language: 'javascript',
      },
    ])

    expect(result.legacyRecovery).toBe('recovered')
    expect(result.fragments).toHaveLength(2)
    expect(result.fragments[0].value).toBe(
      [
        'Intro',
        '## Fragment: Fragment 2',
        '```plain_text',
        'not a fragment boundary',
        '```',
        'Outro',
      ].join('\n'),
    )
    expect(result.fragments[1].value).toBe('console.log("second")')
  })
})
