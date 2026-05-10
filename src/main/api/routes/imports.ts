import type {
  ImportApplyResponse,
  ImportPreviewResponse,
} from '../dto/imports'
import { Elysia } from 'elysia'
import { applyImport, previewImport } from '../../import'
import { commonMessageResponse } from '../dto/common/response'
import { importsDTO } from '../dto/imports'

const app = new Elysia({ prefix: '/imports' })

function mapImportError(status: unknown, error: unknown): never {
  const setStatus = status as (
    code: number,
    payload: { message: string },
  ) => never

  if (error instanceof Error) {
    return setStatus(400, { message: error.message })
  }

  return setStatus(500, { message: 'Import failed' })
}

app
  .use(importsDTO)
  .post(
    '/preview',
    async ({ body, status }) => {
      try {
        return (await previewImport(body.source, {
          files: body.files,
          space: body.space,
          url: body.url,
        })) as ImportPreviewResponse
      }
      catch (error) {
        return mapImportError(status, error)
      }
    },
    {
      body: 'importPreviewInput',
      response: {
        200: 'importPreviewResponse',
        400: commonMessageResponse,
      },
      detail: {
        tags: ['Imports'],
      },
    },
  )
  .post(
    '/apply',
    async ({ body, status }) => {
      try {
        return (await applyImport(body.source, {
          files: body.files,
          space: body.space,
          url: body.url,
        })) as ImportApplyResponse
      }
      catch (error) {
        return mapImportError(status, error)
      }
    },
    {
      body: 'importApplyInput',
      response: {
        200: 'importApplyResponse',
        400: commonMessageResponse,
      },
      detail: {
        tags: ['Imports'],
      },
    },
  )

export default app
