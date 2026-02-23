import type { FoldersResponse, FoldersTree } from '../dto/folders'
import { Elysia } from 'elysia'
import { useStorage } from '../../storage'
import { commonAddResponse } from '../dto/common/response'
import { foldersDTO } from '../dto/folders'

const app = new Elysia({ prefix: '/folders' })

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

  if (parsedError.code === 'FOLDER_NOT_FOUND') {
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
  .use(foldersDTO)
  // Получение списка папок
  .get(
    '/',
    () => {
      const storage = useStorage()
      const result = storage.folders.getFolders()

      return result as FoldersResponse
    },
    {
      response: 'foldersResponse',
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Получение папок в виде древовидной структуры
  .get(
    '/tree',
    (): any => {
      const storage = useStorage()

      return storage.folders.getFoldersTree() as FoldersTree
    },
    {
      response: 'foldersTreeResponse',
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Добавление папки
  .post(
    '/',
    ({ body, status }) => {
      const storage = useStorage()
      try {
        const { id } = storage.folders.createFolder(body)

        return { id }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'foldersAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Обновление папки
  .patch(
    '/:id',
    ({ params, body, status }) => {
      const storage = useStorage()
      try {
        const { invalidInput, notFound } = storage.folders.updateFolder(
          Number(params.id),
          body,
        )

        if (invalidInput) {
          return status(400, { message: 'Need at least one field to update' })
        }

        if (notFound) {
          return status(404, { message: 'Folder not found' })
        }

        return { message: 'Folder updated' }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'foldersUpdate',
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Удаление папки
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useStorage()
      try {
        const { deleted } = storage.folders.deleteFolder(Number(params.id))

        if (!deleted) {
          return status(404, { message: 'Folder not found' })
        }

        return { message: 'Folder deleted' }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      detail: {
        tags: ['Folders'],
      },
    },
  )

export default app
