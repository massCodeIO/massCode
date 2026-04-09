import type { MarkdownNote } from './types'
import {
  findInternalLinks,
  resolveInternalLinkTargetByTitle,
} from '../../../../../../shared/notes/internalLinks'

export interface NotesGraphSnippetLookup {
  id: number
  name: string
}

export interface NotesGraphNode {
  id: number
  name: string
  folderId: number | null
  tagIds: number[]
  incomingLinksCount: number
}

export interface NotesGraphEdge {
  source: number
  target: number
}

export interface NotesGraphData {
  nodes: NotesGraphNode[]
  edges: NotesGraphEdge[]
}

interface BuildNotesGraphInput {
  notes: MarkdownNote[]
  snippets: NotesGraphSnippetLookup[]
}

export function buildNotesGraph(input: BuildNotesGraphInput): NotesGraphData {
  const noteIds = new Set(input.notes.map(note => note.id))
  const incomingCounts = new Map<number, number>()
  const edgeKeys = new Set<string>()
  const edges: NotesGraphEdge[] = []
  const linkLookup = [
    ...input.snippets.map(snippet => ({
      id: snippet.id,
      name: snippet.name,
      type: 'snippet' as const,
    })),
    ...input.notes.map(note => ({
      id: note.id,
      name: note.name,
      type: 'note' as const,
    })),
  ]

  for (const note of input.notes) {
    const links = findInternalLinks(note.content)

    for (const link of links) {
      let targetId: number | null = null

      if (link.legacyTarget) {
        if (link.legacyTarget.type !== 'note') {
          continue
        }

        targetId = noteIds.has(link.legacyTarget.id)
          ? link.legacyTarget.id
          : null
      }
      else {
        const resolvedTarget = resolveInternalLinkTargetByTitle(
          link.target,
          linkLookup,
        )

        if (!resolvedTarget || resolvedTarget.type !== 'note') {
          continue
        }

        targetId = resolvedTarget.id
      }

      if (targetId === null || targetId === note.id) {
        continue
      }

      const edgeKey = `${note.id}->${targetId}`
      if (edgeKeys.has(edgeKey)) {
        continue
      }

      edgeKeys.add(edgeKey)
      edges.push({ source: note.id, target: targetId })
      incomingCounts.set(targetId, (incomingCounts.get(targetId) ?? 0) + 1)
    }
  }

  return {
    nodes: input.notes.map(note => ({
      id: note.id,
      name: note.name,
      folderId: note.folderId,
      incomingLinksCount: incomingCounts.get(note.id) ?? 0,
      tagIds: note.tags,
    })),
    edges,
  }
}
