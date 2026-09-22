import { z } from 'zod'
import {
  workspaceFieldsSchema,
  workspaceSpaceSchema,
} from '../../shared/aiWorkspace'

const commonFields = workspaceFieldsSchema.pick({
  name: true,
  description: true,
  isFavorites: true,
  isDeleted: true,
  folderId: true,
  folderOperation: true,
})
const folderFields = workspaceFieldsSchema.pick({
  name: true,
  folderId: true,
  folderOperation: true,
})
const updateTarget = {
  action: z.literal('update'),
  id: z.number().int().positive(),
}
const folderCreate = { kind: z.literal('folder'), action: z.literal('create') }
const folderUpdate = { kind: z.literal('folder'), ...updateTarget }
// The public review contract is narrower than the internal manager plan.
export const workspaceReviewSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    operations: z
      .array(
        z.union([
          z
            .object({
              space: z.literal('code'),
              kind: z.literal('item'),
              ...updateTarget,
              fields: commonFields.extend(
                workspaceFieldsSchema.pick({
                  content: true,
                  contentId: true,
                  language: true,
                  tags: true,
                }).shape,
              ),
            })
            .strict(),
          z
            .object({
              space: z.literal('notes'),
              kind: z.literal('item'),
              ...updateTarget,
              fields: commonFields.extend(
                workspaceFieldsSchema.pick({
                  content: true,
                  properties: true,
                  tags: true,
                }).shape,
              ),
            })
            .strict(),
          z
            .object({
              space: z.literal('http'),
              kind: z.literal('item'),
              ...updateTarget,
              fields: commonFields.extend(
                workspaceFieldsSchema.pick({
                  method: true,
                  url: true,
                  headers: true,
                  query: true,
                  bodyType: true,
                  body: true,
                  auth: true,
                  scripts: true,
                }).shape,
              ),
            })
            .strict(),
          z
            .object({
              space: z.enum(['code', 'notes']),
              ...folderCreate,
              fields: folderFields.extend({
                name: workspaceFieldsSchema.shape.name.unwrap(),
              }),
            })
            .strict(),
          z
            .object({
              space: z.literal('http'),
              ...folderCreate,
              fields: folderFields.extend({
                name: workspaceFieldsSchema.shape.name.unwrap(),
                collection: z.boolean().optional(),
              }),
            })
            .strict(),
          z
            .object({
              space: workspaceSpaceSchema,
              ...folderUpdate,
              fields: folderFields,
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(30),
  })
  .strict()
