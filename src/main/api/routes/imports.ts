import type {
  ImportApplyResponse,
  ImportPreviewResponse,
} from '../dto/imports'
import { Elysia } from 'elysia'
import {
  applySnippetImport,
  previewSnippetImport,
} from '../../import/snippets'
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
    ({ body, status }) => {
      try {
        return previewSnippetImport(
          body.source,
          body.files,
        ) as ImportPreviewResponse
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
    ({ body, status }) => {
      try {
        return applySnippetImport(
          body.source,
          body.files,
        ) as ImportApplyResponse
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
