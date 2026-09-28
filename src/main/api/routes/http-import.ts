import type {
  HttpImportApplyResponse,
  HttpImportPreviewResponse,
} from '../dto/http-import'
import { Elysia } from 'elysia'
import { applyHttpImport, previewHttpImport } from '../../http/import'
import { commonMessageResponse } from '../dto/common/response'
import { httpImportDTO } from '../dto/http-import'

const app = new Elysia({ prefix: '/http-import' })

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
  .use(httpImportDTO)
  .post(
    '/preview',
    async ({ body, status }) => {
      try {
        return (await previewHttpImport(
          body.files,
        )) as HttpImportPreviewResponse
      }
      catch (error) {
        return mapImportError(status, error)
      }
    },
    {
      body: 'httpImportPreviewInput',
      response: {
        200: 'httpImportPreviewResponse',
        400: commonMessageResponse,
      },
      detail: {
        tags: ['HTTP Import'],
      },
    },
  )
  .post(
    '/apply',
    async ({ body, status }) => {
      try {
        return (await applyHttpImport(body.files, {
          selectedCollectionIndexes: body.selectedCollectionIndexes,
          selectedEnvironmentIndexes: body.selectedEnvironmentIndexes,
        })) as HttpImportApplyResponse
      }
      catch (error) {
        return mapImportError(status, error)
      }
    },
    {
      body: 'httpImportApplyInput',
      response: {
        200: 'httpImportApplyResponse',
        400: commonMessageResponse,
      },
      detail: {
        tags: ['HTTP Import'],
      },
    },
  )

export default app
