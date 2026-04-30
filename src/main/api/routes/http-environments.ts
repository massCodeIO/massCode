import type { HttpEnvironmentsResponse } from '../dto/http-environments'
import { Elysia } from 'elysia'
import { useHttpStorage } from '../../storage'
import { commonAddResponse } from '../dto/common/response'
import { httpEnvironmentsDTO } from '../dto/http-environments'

const app = new Elysia({ prefix: '/http-environments' })

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
  .use(httpEnvironmentsDTO)
  .get(
    '/',
    () => {
      const storage = useHttpStorage()
      const items = storage.environments.getEnvironments()
      const activeId = storage.environments.getActiveEnvironmentId()

      return { activeId, items } as HttpEnvironmentsResponse
    },
    {
      response: 'httpEnvironmentsResponse',
      detail: {
        tags: ['HTTP Environments'],
      },
    },
  )
  .post(
    '/',
    ({ body, status }) => {
      const storage = useHttpStorage()
      try {
        const { id } = storage.environments.createEnvironment(body)

        return { id }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'httpEnvironmentsAdd',
      response: commonAddResponse,
      detail: {
        tags: ['HTTP Environments'],
      },
    },
  )
  .patch(
    '/:id',
    ({ params, body, status }) => {
      const storage = useHttpStorage()
      try {
        const { invalidInput, notFound }
          = storage.environments.updateEnvironment(Number(params.id), body)

        if (invalidInput) {
          return status(400, { message: 'Need at least one field to update' })
        }

        if (notFound) {
          return status(404, { message: 'Environment not found' })
        }

        return { message: 'Environment updated' }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'httpEnvironmentsUpdate',
      detail: {
        tags: ['HTTP Environments'],
      },
    },
  )
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useHttpStorage()
      const { deleted } = storage.environments.deleteEnvironment(
        Number(params.id),
      )

      if (!deleted) {
        return status(404, { message: 'Environment not found' })
      }

      return { message: 'Environment deleted' }
    },
    {
      detail: {
        tags: ['HTTP Environments'],
      },
    },
  )
  .post(
    '/active',
    ({ body, status }) => {
      const storage = useHttpStorage()
      const { notFound } = storage.environments.setActiveEnvironment(body.id)

      if (notFound) {
        return status(404, { message: 'Environment not found' })
      }

      return { message: 'Active environment set' }
    },
    {
      body: 'httpEnvironmentsSetActive',
      detail: {
        tags: ['HTTP Environments'],
      },
    },
  )

export default app
