import type { NotesGraphResponse } from '../dto/notes-dashboard'
import Elysia from 'elysia'
import { useNotesStorage, useStorage } from '../../storage'
import { buildNotesGraph } from '../../storage/providers/markdown/notes/runtime/graph'
import { notesDashboardDTO } from '../dto/notes-dashboard'

const app = new Elysia({ prefix: '/notes' })

app.use(notesDashboardDTO).get(
  '/graph',
  () => {
    const notesStorage = useNotesStorage()
    const storage = useStorage()
    const notes = notesStorage.notes.getNotes({ isDeleted: 0 })
    const snippets = storage.snippets.getSnippets({ isDeleted: 0 })

    return buildNotesGraph({
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
    }) as NotesGraphResponse
  },
  {
    response: 'notesGraphResponse',
    detail: {
      tags: ['Notes Dashboard'],
    },
  },
)

export default app
