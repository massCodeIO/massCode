import type {
  SnippetItemResponse,
  SnippetsCountsResponse,
  SnippetsResponse,
} from '../dto/snippets'
import Elysia from 'elysia'
import { useStorage } from '../../storage'
import {
  commonAddResponse,
  commonMessageResponse,
} from '../dto/common/response'
import { snippetsDTO } from '../dto/snippets'

const app = new Elysia({ prefix: '/snippets' })

function parseStorageError(
  error: unknown,
): { code: string, message: string } | null {
  if (!(error instanceof Error)) {
    return null
  }

  const separatorIndex = error.message.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    code: error.message.slice(0, separatorIndex),
    message: error.message.slice(separatorIndex + 1).trim(),
  }
}

function mapStorageError(status: unknown, error: unknown): never {
  const setStatus = status as (
    code: number,
    payload: { message: string },
  ) => never
  const parsedError = parseStorageError(error)

  if (!parsedError) {
    return setStatus(500, { message: 'Internal storage error' })
  }

  if (parsedError.code === 'NAME_CONFLICT') {
    return setStatus(409, { message: parsedError.message })
  }

  if (
    parsedError.code === 'FOLDER_NOT_FOUND'
    || parsedError.code === 'SNIPPET_NOT_FOUND'
  ) {
    return setStatus(404, { message: parsedError.message })
  }

  if (
    parsedError.code === 'INVALID_NAME'
    || parsedError.code === 'RESERVED_NAME'
  ) {
    return setStatus(400, { message: parsedError.message })
  }

  return setStatus(500, {
    message: parsedError.message || 'Internal storage error',
  })
}

app
  .use(snippetsDTO)
  // Получение списка сниппетов c возможностью фильтрации
  .get(
    '/',
    ({ query }) => {
      const storage = useStorage()
      const result = storage.snippets.getSnippets(query)

      return result as SnippetsResponse
    },
    {
      query: 'snippetsQuery',
      response: 'snippetsResponse',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Получение кол-ва сниппетов
  .get(
    '/counts',
    () => {
      const storage = useStorage()
      return storage.snippets.getSnippetsCounts() as SnippetsCountsResponse
    },
    {
      response: 'snippetsCountsResponse',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  .get(
    '/:id',
    ({ params, status }) => {
      const storage = useStorage()
      const snippet = storage.snippets.getSnippetById(Number(params.id))

      if (!snippet) {
        return status(404, { message: 'Snippet not found' })
      }

      return snippet as SnippetItemResponse
    },
    {
      response: {
        200: 'snippetItemResponse',
        404: commonMessageResponse,
      },
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Создание сниппета
  .post(
    '/',
    ({ body, status }) => {
      const storage = useStorage()
      try {
        const { id } = storage.snippets.createSnippet(body)

        return { id }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'snippetsAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Добавление содержимого сниппета
  .post(
    '/:id/contents',
    ({ params, body, status }) => {
      const storage = useStorage()
      try {
        const { id } = storage.snippets.createSnippetContent(
          Number(params.id),
          body,
        )

        return { id }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'snippetContentsAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Обновление сниппета
  .patch(
    '/:id',
    ({ params, body, status }) => {
      const storage = useStorage()
      try {
        const { invalidInput, notFound } = storage.snippets.updateSnippet(
          Number(params.id),
          body,
        )

        if (invalidInput) {
          return status(400, { message: 'Need at least one field to update' })
        }

        if (notFound) {
          return status(404, { message: 'Snippet not found' })
        }

        return { message: 'Snippet updated' }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'snippetsUpdate',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Обновление содержимого сниппета
  .patch(
    '/:id/contents/:contentId',
    ({ params, body, status }) => {
      const storage = useStorage()
      const { invalidInput, notFound, parentNotFound }
        = storage.snippets.updateSnippetContent(
          Number(params.id),
          Number(params.contentId),
          body,
        )

      if (invalidInput) {
        return status(400, { message: 'Need at least one field to update' })
      }

      if (notFound) {
        return status(404, { message: 'Snippet content not found' })
      }

      if (parentNotFound) {
        return status(404, { message: 'Snippet not found' })
      }

      return { message: 'Snippet content updated' }
    },
    {
      body: 'snippetContentsUpdate',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Добавление тега к сниппету
  .post(
    '/:id/tags/:tagId',
    ({ params, status }) => {
      const storage = useStorage()
      const { snippetFound, tagFound } = storage.snippets.addTagToSnippet(
        Number(params.id),
        Number(params.tagId),
      )

      if (!snippetFound) {
        return status(404, { message: 'Snippet not found' })
      }

      if (!tagFound) {
        return status(404, { message: 'Tag not found' })
      }

      return { message: 'Tag added to snippet' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление тега из сниппета
  .delete(
    '/:id/tags/:tagId',
    ({ params, status }) => {
      const storage = useStorage()
      const { snippetFound, tagFound, relationFound }
        = storage.snippets.deleteTagFromSnippet(
          Number(params.id),
          Number(params.tagId),
        )

      if (!snippetFound) {
        return status(404, { message: 'Snippet not found' })
      }

      if (!tagFound) {
        return status(404, { message: 'Tag not found' })
      }

      if (!relationFound) {
        return status(404, {
          message: 'Tag is not associated with this snippet',
        })
      }

      return { message: 'Tag removed from snippet' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление сниппета
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useStorage()
      const { deleted } = storage.snippets.deleteSnippet(Number(params.id))

      if (!deleted) {
        return status(404, { message: 'Snippet not found' })
      }

      return { message: 'Snippet deleted' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление всех сниппетов в корзине
  .delete(
    '/trash',
    ({ status }) => {
      const storage = useStorage()
      const { deletedCount } = storage.snippets.emptyTrash()

      if (!deletedCount) {
        return status(404, { message: 'No snippets in trash' })
      }

      return {
        message: `Successfully emptied trash: ${deletedCount} snippet(s) deleted`,
      }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление содержимого сниппета
  .delete(
    '/:id/contents/:contentId',
    ({ params, status }) => {
      const storage = useStorage()
      const { deleted } = storage.snippets.deleteSnippetContent(
        Number(params.contentId),
      )

      if (!deleted) {
        return status(404, { message: 'Snippet content not found' })
      }

      return { message: 'Snippet content deleted' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )

export default app
