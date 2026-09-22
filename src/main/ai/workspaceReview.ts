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
              space: z.literal('http'),
              kind: z.literal('environment'),
              action: z.literal('create'),
              fields: workspaceFieldsSchema
                .pick({ name: true, variables: true, activate: true })
                .extend({ name: workspaceFieldsSchema.shape.name.unwrap() }),
            })
            .strict(),
          z
            .object({
              space: z.literal('http'),
              kind: z.literal('environment'),
              ...updateTarget,
              fields: workspaceFieldsSchema.pick({
                name: true,
                variables: true,
                unset: true,
              }),
            })
            .strict(),
          z
            .object({
              space: z.literal('http'),
              kind: z.literal('environment'),
              action: z.literal('delete'),
              id: z.number().int().positive(),
              fields: z.object({}).strict(),
            })
            .strict(),
          z
            .object({
              space: z.literal('http'),
              kind: z.literal('environment'),
              action: z.literal('activate'),
              fields: z
                .object({
                  environmentId: z.number().int().positive().nullable(),
                })
                .strict(),
            })
            .strict(),
          z
            .object({
              space: z.literal('code'),
              kind: z.literal('fragment'),
              action: z.literal('create'),
              id: z.number().int().positive().describe('Parent snippet ID'),
              fields: workspaceFieldsSchema
                .pick({ label: true, content: true, language: true })
                .extend({
                  label: workspaceFieldsSchema.shape.label.unwrap(),
                  content: workspaceFieldsSchema.shape.content.unwrap(),
                  language: workspaceFieldsSchema.shape.language.unwrap(),
                }),
            })
            .strict(),
          z
            .object({
              space: z.literal('code'),
              kind: z.literal('fragment'),
              ...updateTarget,
              fields: workspaceFieldsSchema
                .pick({
                  label: true,
                  content: true,
                  language: true,
                  contentId: true,
                })
                .extend({
                  contentId: workspaceFieldsSchema.shape.contentId.unwrap(),
                }),
            })
            .strict(),
          z
            .object({
              space: z.literal('code'),
              kind: z.literal('fragment'),
              action: z.literal('delete'),
              id: z.number().int().positive().describe('Parent snippet ID'),
              fields: z
                .object({
                  contentId: workspaceFieldsSchema.shape.contentId.unwrap(),
                })
                .strict(),
            })
            .strict(),
          z
            .object({
              space: workspaceSpaceSchema,
              kind: z.literal('item'),
              action: z.enum(['trash', 'restore', 'permanentDelete']),
              id: z.number().int().positive(),
              fields: z.object({}).strict(),
            })
            .strict(),
          z
            .object({
              space: workspaceSpaceSchema,
              kind: z.enum(['folder', 'tag']),
              action: z.literal('delete'),
              id: z.number().int().positive(),
              fields: z.object({}).strict(),
            })
            .strict(),
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
                  protocol: true,
                  formData: true,
                  runtime: true,
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
              fields: folderFields.extend({
                collectionConfig: workspaceFieldsSchema.shape.collectionConfig,
              }),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(30),
  })
  .strict()
