import type {
  HttpRequestItemResponse,
  HttpRequestsResponse,
} from '../dto/http-requests'
import { Elysia } from 'elysia'
import { useHttpStorage } from '../../storage'
import {
  commonAddResponse,
  commonMessageResponse,
} from '../dto/common/response'
import { httpRequestsDTO } from '../dto/http-requests'

const app = new Elysia({ prefix: '/http-requests' })

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
  .use(httpRequestsDTO)
  .get(
    '/',
    ({ query }) => {
      const storage = useHttpStorage()
      const result = storage.requests.getRequests(query)

      return result as HttpRequestsResponse
    },
    {
      query: 'httpRequestsQuery',
      response: 'httpRequestsResponse',
      detail: {
        tags: ['HTTP Requests'],
      },
    },
  )
  .get(
    '/:id',
    ({ params, status }) => {
      const storage = useHttpStorage()
      const request = storage.requests.getRequestById(Number(params.id))

      if (!request) {
        return status(404, { message: 'Request not found' })
      }

      return request as HttpRequestItemResponse
    },
    {
      response: {
        200: 'httpRequestItemResponse',
        404: commonMessageResponse,
      },
      detail: {
        tags: ['HTTP Requests'],
      },
    },
  )
  .post(
    '/',
    ({ body, status }) => {
      const storage = useHttpStorage()
      try {
        const { id } = storage.requests.createRequest(body)

        return { id }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'httpRequestsAdd',
      response: commonAddResponse,
      detail: {
        tags: ['HTTP Requests'],
      },
    },
  )
  .patch(
    '/:id',
    ({ params, body, status }) => {
      const storage = useHttpStorage()
      try {
        const { invalidInput, notFound } = storage.requests.updateRequest(
          Number(params.id),
          body,
        )

        if (invalidInput) {
          return status(400, { message: 'Need at least one field to update' })
        }

        if (notFound) {
          return status(404, { message: 'Request not found' })
        }

        return { message: 'Request updated' }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'httpRequestsUpdate',
      detail: {
        tags: ['HTTP Requests'],
      },
    },
  )
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useHttpStorage()
      const { deleted } = storage.requests.deleteRequest(Number(params.id))

      if (!deleted) {
        return status(404, { message: 'Request not found' })
      }

      return { message: 'Request deleted' }
    },
    {
      detail: {
        tags: ['HTTP Requests'],
      },
    },
  )

export default app
