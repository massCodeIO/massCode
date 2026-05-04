import Elysia, { t } from 'elysia'

const httpImportFile = t.Object({
  content: t.String(),
  name: t.String(),
})

const httpImportWarning = t.Object({
  message: t.String(),
  source: t.String(),
})

const httpImportPreviewCollection = t.Object({
  folders: t.Number(),
  index: t.Number(),
  name: t.String(),
  requests: t.Number(),
})

const httpImportPreviewEnvironment = t.Object({
  index: t.Number(),
  name: t.String(),
  variables: t.Number(),
})

const httpImportPreviewInput = t.Object({
  files: t.Array(httpImportFile),
})

const httpImportApplyInput = t.Object({
  files: t.Array(httpImportFile),
  selectedCollectionIndexes: t.Optional(t.Array(t.Number())),
  selectedEnvironmentIndexes: t.Optional(t.Array(t.Number())),
})

const httpImportPreviewResponse = t.Object({
  collections: t.Array(httpImportPreviewCollection),
  environments: t.Array(httpImportPreviewEnvironment),
  warnings: t.Array(httpImportWarning),
})

const httpImportApplyResponse = t.Object({
  collections: t.Number(),
  createdCollectionNames: t.Array(t.String()),
  environments: t.Number(),
  folders: t.Number(),
  requests: t.Number(),
  warnings: t.Array(httpImportWarning),
})

export const httpImportDTO = new Elysia().model({
  httpImportApplyInput,
  httpImportApplyResponse,
  httpImportPreviewInput,
  httpImportPreviewResponse,
})

export type HttpImportPreviewInput = typeof httpImportPreviewInput.static
export type HttpImportApplyInput = typeof httpImportApplyInput.static
export type HttpImportPreviewResponse = typeof httpImportPreviewResponse.static
export type HttpImportApplyResponse = typeof httpImportApplyResponse.static
