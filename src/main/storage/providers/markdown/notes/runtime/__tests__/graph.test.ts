import type { MarkdownNote } from '../types'
import { describe, expect, it } from 'vitest'
import { buildNotesGraph } from '../graph'

interface SnippetLookup {
  id: number
  name: string
}

function createNote(
  id: number,
  name: string,
  content: string,
  overrides: Partial<MarkdownNote> = {},
): MarkdownNote {
  return {
    content,
    createdAt: 1,
    description: null,
    filePath: `${name}.md`,
    folderId: null,
    id,
    isDeleted: 0,
    isFavorites: 0,
    name,
    tags: [],
    updatedAt: 1,
    ...overrides,
  }
}

describe('buildNotesGraph', () => {
  it('builds a note-to-note edge from an exact title link', () => {
    const graph = buildNotesGraph({
      notes: [
        createNote(1, 'Source', 'See [[Target]]'),
        createNote(2, 'Target', ''),
      ],
      snippets: [],
    })

    expect(graph.edges).toEqual([{ source: 1, target: 2 }])
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: 2,
        incomingLinksCount: 1,
      }),
    )
  })

  it('prefers snippet title matches over note title matches and skips such edges', () => {
    const snippets: SnippetLookup[] = [{ id: 50, name: 'Architecture' }]
    const graph = buildNotesGraph({
      notes: [
        createNote(1, 'Source', 'See [[Architecture]]'),
        createNote(2, 'Architecture', ''),
      ],
      snippets,
    })

    expect(graph.edges).toEqual([])
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: 2,
        incomingLinksCount: 0,
      }),
    )
  })

  it('supports legacy note:id links', () => {
    const graph = buildNotesGraph({
      notes: [
        createNote(1, 'Source', 'See [[note:2|Target]]'),
        createNote(2, 'Target', ''),
      ],
      snippets: [],
    })

    expect(graph.edges).toEqual([{ source: 1, target: 2 }])
  })

  it('collapses duplicate edges and ignores broken or self links', () => {
    const graph = buildNotesGraph({
      notes: [
        createNote(
          1,
          'Source',
          '[[Target]] [[Target|Again]] [[Missing]] [[note:1|Self]]',
        ),
        createNote(2, 'Target', ''),
      ],
      snippets: [],
    })

    expect(graph.edges).toEqual([{ source: 1, target: 2 }])
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: 2,
        incomingLinksCount: 1,
      }),
    )
  })
})
