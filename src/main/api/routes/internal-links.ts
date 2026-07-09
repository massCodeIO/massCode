import type { InternalLinkLookupItem } from '../../../shared/notes/internalLinks'
import type { InternalLinksResolveResponse } from '../dto/internal-links'
import Elysia from 'elysia'
import { buildNoteFolderPathMap } from '../../../shared/notes/folderPath'
import { useHttpStorage, useNotesStorage, useStorage } from '../../storage'
import { createInternalLinkResolver } from '../../storage/providers/markdown/notes/runtime/internalLinkResolver'
import { internalLinksDTO } from '../dto/internal-links'

const NOTE_CONTENT_EXCERPT_LENGTH = 400

const app = new Elysia({ prefix: '/internal-links' })

app.use(internalLinksDTO).post(
  '/resolve',
  ({ body }) => {
    // Один batch-запрос вместо пакета из 5 запросов на каждую ссылку:
    // резолв и данные превью собираются в main по runtime-кэшу.
    const titles = [
      ...new Set(body.titles.map(t => t.trim()).filter(Boolean)),
    ]

    if (!titles.length) {
      return [] as InternalLinksResolveResponse
    }

    const storage = useStorage()
    const notesStorage = useNotesStorage()
    const httpStorage = useHttpStorage()

    const snippets = storage.snippets.getSnippets({ isDeleted: 0 })
    const notes = notesStorage.notes.getNotes({ isDeleted: 0 })
    const noteFolders = notesStorage.folders.getFolders()
    const httpRequests = httpStorage.requests.getRequests()
    const httpFolders = httpStorage.folders.getFolders()

    const noteFolderPathById = buildNoteFolderPathMap(noteFolders)
    const httpFolderPathById = buildNoteFolderPathMap(httpFolders)

    const resolver = createInternalLinkResolver([
      ...snippets.map<InternalLinkLookupItem>(snippet => ({
        id: snippet.id,
        name: snippet.name,
        type: 'snippet',
      })),
      ...notes.map<InternalLinkLookupItem>(note => ({
        folderPath: note.folder
          ? noteFolderPathById.get(note.folder.id)
          : undefined,
        id: note.id,
        name: note.name,
        type: 'note',
      })),
      ...httpRequests.map<InternalLinkLookupItem>(request => ({
        folderPath:
          request.folderId === null
            ? ''
            : (httpFolderPathById.get(request.folderId) ?? ''),
        id: request.id,
        name: request.name,
        type: 'http-request',
      })),
    ])

    const snippetById = new Map(snippets.map(s => [s.id, s]))
    const noteById = new Map(notes.map(n => [n.id, n]))
    const requestById = new Map(httpRequests.map(r => [r.id, r]))

    return titles.map((title) => {
      const target = resolver.resolve(title)

      if (!target) {
        return { title, resolved: null }
      }

      if (target.type === 'snippet') {
        // getSnippetById дочитывает ленивое тело: превью нужен фрагмент.
        const snippet = snippetById.has(target.id)
          ? storage.snippets.getSnippetById(target.id)
          : null

        if (!snippet) {
          return { title, resolved: null }
        }

        return {
          title,
          resolved: {
            type: 'snippet' as const,
            id: snippet.id,
            name: snippet.name,
            folder: snippet.folder,
            isDeleted: snippet.isDeleted,
            firstContent: snippet.contents[0]
              ? {
                  language: snippet.contents[0].language,
                  value: snippet.contents[0].value,
                }
              : null,
          },
        }
      }

      if (target.type === 'http-request') {
        // getRequestById дочитывает ленивые детали: превью нужен description.
        const request = requestById.has(target.id)
          ? httpStorage.requests.getRequestById(target.id)
          : null

        if (!request) {
          return { title, resolved: null }
        }

        return {
          title,
          resolved: {
            type: 'http-request' as const,
            id: request.id,
            name: request.name,
            folder: null,
            isDeleted: request.isDeleted,
            request: {
              method: request.method,
              url: request.url,
              description: request.description,
            },
          },
        }
      }

      // getNoteById дочитывает ленивое тело: превью нужен excerpt.
      const note = noteById.has(target.id)
        ? notesStorage.notes.getNoteById(target.id)
        : null

      if (!note) {
        return { title, resolved: null }
      }

      return {
        title,
        resolved: {
          type: 'note' as const,
          id: note.id,
          name: note.name,
          folder: note.folder,
          isDeleted: note.isDeleted,
          contentExcerpt: note.content
            .slice(0, NOTE_CONTENT_EXCERPT_LENGTH)
            .trim(),
        },
      }
    }) as InternalLinksResolveResponse
  },
  {
    body: 'internalLinksResolveBody',
    response: 'internalLinksResolveResponse',
    detail: {
      tags: ['InternalLinks'],
    },
  },
)

export default app
