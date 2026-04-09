import type { NotesDashboardResponse } from '../dto/notes-dashboard'
import Elysia from 'elysia'
import { useNotesStorage, useStorage } from '../../storage'
import { buildNotesGraph } from '../../storage/providers/markdown/notes/runtime/graph'
import { notesDashboardDTO } from '../dto/notes-dashboard'

const RECENT_NOTES_LIMIT = 6
const TOP_LINKED_NOTES_LIMIT = 6

function countWords(content: string): number {
  if (!content.trim()) {
    return 0
  }

  return content.trim().split(/\s+/).filter(Boolean).length
}

function getDayKey(timestamp: number): string {
  const date = new Date(timestamp)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function buildActivity(updatedAtList: number[]) {
  const days: Record<string, number> = {}

  updatedAtList.forEach((updatedAt) => {
    const dayKey = getDayKey(updatedAt)
    days[dayKey] = (days[dayKey] ?? 0) + 1
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()
  const todayStart = todayTime
  const sevenDaysAgo = todayTime - 6 * 24 * 60 * 60 * 1000

  return {
    days,
    notesUpdatedLast7Days: updatedAtList.filter(
      updatedAt => updatedAt >= sevenDaysAgo,
    ).length,
    notesUpdatedToday: updatedAtList.filter(
      updatedAt => updatedAt >= todayStart,
    ).length,
  }
}

const app = new Elysia({ prefix: '/notes' })

app.use(notesDashboardDTO).get(
  '/dashboard',
  () => {
    const notesStorage = useNotesStorage()
    const storage = useStorage()
    const notes = notesStorage.notes.getNotes({ isDeleted: 0 })
    const folders = notesStorage.folders.getFolders()
    const tags = notesStorage.tags.getTags()
    const snippets = storage.snippets.getSnippets({ isDeleted: 0 })

    const graph = buildNotesGraph({
      notes: notes.map(note => ({
        content: note.content,
        createdAt: note.createdAt,
        description: note.description,
        filePath: '',
        folderId: note.folder?.id ?? null,
        id: note.id,
        isDeleted: note.isDeleted,
        isFavorites: note.isFavorites,
        name: note.name,
        tags: note.tags.map(tag => tag.id),
        updatedAt: note.updatedAt,
      })),
      snippets: snippets.map(snippet => ({
        id: snippet.id,
        name: snippet.name,
      })),
    })

    return {
      activity: buildActivity(notes.map(note => note.updatedAt)),
      graphPreview: {
        edges: graph.edges,
        nodes: graph.nodes.map(node => ({
          id: node.id,
          name: node.name,
          folderId: node.folderId,
          incomingLinksCount: node.incomingLinksCount,
        })),
      },
      recent: [...notes]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, RECENT_NOTES_LIMIT)
        .map(note => ({
          id: note.id,
          name: note.name,
          folder: note.folder,
          updatedAt: note.updatedAt,
        })),
      stats: {
        foldersCount: folders.length,
        notesCount: notes.length,
        tagsCount: tags.length,
        wordsCount: notes.reduce(
          (total, note) => total + countWords(note.content),
          0,
        ),
      },
      topLinked: [...graph.nodes]
        .filter(node => node.incomingLinksCount > 0)
        .sort(
          (left, right) => right.incomingLinksCount - left.incomingLinksCount,
        )
        .slice(0, TOP_LINKED_NOTES_LIMIT)
        .map(node => ({
          id: node.id,
          incomingLinksCount: node.incomingLinksCount,
          name: node.name,
        })),
    } as NotesDashboardResponse
  },
  {
    response: 'notesDashboardResponse',
    detail: {
      tags: ['Notes Dashboard'],
    },
  },
)

export default app
