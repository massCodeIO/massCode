import type { AiVaultItem } from './ai'
import { z } from 'zod'
import { httpScriptsSchema } from './httpScripts'

export const workspaceSpaceSchema = z.enum(['code', 'notes', 'http'])
const name = z.string().trim().min(1).max(256)
const entry = z
  .object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean(),
    description: z.string().optional(),
  })
  .strict()
export const workspaceFieldsSchema = z
  .object({
    name: name.optional(),
    description: z.string().max(100000).optional(),
    content: z.string().max(200000).optional(),
    language: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .toLowerCase()
      .optional()
      .describe(
        'Code items only: programming language of the snippet, not the language of the conversation. Omit for Notes and HTTP.',
      ),
    contentId: z.number().int().positive().optional(),
    folderOperation: z.number().int().min(0).max(29).optional(),
    folderId: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .describe(
        'Destination requested by the user. Omit or use null for Inbox/root when no destination was requested; do not infer a folder from similar names.',
      ),
    tags: z
      .array(name)
      .max(100)
      .optional()
      .describe(
        'Code and Notes only. Set tags when requested, not automatically based on content or title.',
      ),
    method: z
      .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
      .optional(),
    url: z.string().max(8192).optional(),
    headers: z.array(entry).max(100).optional(),
    query: z.array(entry).max(100).optional(),
    bodyType: z
      .enum(['none', 'json', 'text', 'graphql', 'form-urlencoded'])
      .optional(),
    body: z.string().max(200000).optional(),
    collection: z.boolean().optional(),
    isFavorites: z.union([z.literal(0), z.literal(1)]).optional(),
    isDeleted: z.union([z.literal(0), z.literal(1)]).optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    scripts: httpScriptsSchema.optional(),
    auth: z
      .object({
        type: z.enum(['none', 'inherit', 'bearer', 'basic', 'apikey']),
        key: z.string().optional(),
        value: z.string().optional(),
        in: z.enum(['header', 'query']).optional(),
        token: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
export const workspaceOperationSchema = z
  .object({
    space: workspaceSpaceSchema,
    kind: z.enum(['item', 'folder']),
    action: z.enum(['create', 'update']),
    id: z.number().int().positive().optional(),
    fields: workspaceFieldsSchema,
  })
  .strict()
export const workspacePlanSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    operations: z.array(workspaceOperationSchema).min(1).max(30),
  })
  .strict()
export const workspaceCreateSchema = workspacePlanSchema.extend({
  operations: z
    .array(
      workspaceOperationSchema
        .omit({ id: true })
        .extend({ action: z.literal('create') }),
    )
    .min(1)
    .max(30),
})
export type WorkspaceOperation = z.infer<typeof workspaceOperationSchema>
export interface WorkspaceChange {
  operation: WorkspaceOperation
  name: string
  before: string
  after: string
}
export interface WorkspaceProposal {
  id: string
  summary: string
  changes: WorkspaceChange[]
}
export interface WorkspaceItem extends AiVaultItem {
  operationIndex: number
}
export interface WorkspaceContainer {
  operationIndex: number
  id: number
  name: string
  space: WorkspaceOperation['space']
  kind: 'folder' | 'collection'
}
export interface WorkspaceCreation {
  proposal: WorkspaceProposal
  applied: number[]
  undone: number[]
  items: WorkspaceItem[]
  containers: WorkspaceContainer[]
  failedOperationIndex?: number
}
export interface WorkspaceApplyResult {
  containers?: WorkspaceContainer[]
  applied: number[]
  items: WorkspaceItem[]
  failed?: number
}

// Historical creation facts never change when the user later undoes an operation.
export function workspaceCreationHistory(creation: WorkspaceCreation) {
  const describe = (index: number) => {
    const change = creation.proposal.changes[index]!
    return {
      name: change.name,
      space: change.operation.space,
      kind: change.operation.kind,
    }
  }
  return {
    status:
      creation.failedOperationIndex === undefined
        ? 'created'
        : 'partially_created',
    created: creation.items.map(({ operationIndex: _index, ...item }) => item),
    containers: creation.containers.map(
      ({ operationIndex: _index, ...container }) => container,
    ),
    ...(creation.failedOperationIndex === undefined
      ? {}
      : {
          failed: describe(creation.failedOperationIndex),
          notAttempted: creation.proposal.changes.flatMap((_change, index) =>
            index > creation.failedOperationIndex! ? [describe(index)] : [],
          ),
        }),
  }
}
