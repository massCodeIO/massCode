import { z } from 'zod'
import {
  workspaceFieldsSchema,
  workspaceSpaceSchema,
} from '../../shared/aiWorkspace'

const fields = workspaceFieldsSchema.shape
const common = {
  name: fields.name
    .unwrap()
    .describe(
      'Complete literal user-supplied title, unchanged. Resolve ambiguity before calling this tool; choose a concise title only when none was supplied.',
    ),
  folderId: fields.folderId,
  folderOperation: fields.folderOperation.describe(
    'Zero-based index of the earlier folder/http_collection in THIS items array. Required when creating inside a new folder/collection in this batch; omit folderId in that case.',
  ),
}
const favorite = fields.isFavorites.describe(
  'Only set when the user explicitly requests a favorite.',
)
const metadata = {
  isFavorites: favorite,
  description: fields.description.describe(
    'Only include when the user asked for a description; otherwise omit.',
  ),
  tags: fields.tags,
}
const note = z
  .object({
    type: z.literal('note'),
    ...common,
    ...metadata,
    content: fields.content
      .unwrap()
      .describe(
        'Requested content. Preserve supplied literal text; do not add extra instructions or commentary to it.',
      ),
    properties: fields.properties,
  })
  .strict()
const snippet = z
  .object({
    type: z.literal('snippet'),
    ...common,
    ...metadata,
    content: fields.content
      .unwrap()
      .describe(
        'Requested content. Preserve supplied literal text; do not add extra instructions or commentary to it.',
      ),
    language: fields.language.unwrap(),
  })
  .strict()
const http = z
  .object({
    type: z.literal('http_request'),
    ...common,
    isFavorites: favorite,
    description: fields.description.describe(
      'Only include when the user asked for a description; otherwise omit.',
    ),
    method: fields.method.unwrap(),
    url: fields.url.unwrap(),
    headers: fields.headers,
    query: fields.query,
    bodyType: fields.bodyType,
    body: fields.body,
    auth: fields.auth,
    scripts: fields.scripts,
  })
  .strict()
const folder = z
  .object({
    type: z.literal('folder'),
    space: workspaceSpaceSchema,
    ...common,
  })
  .strict()
const collection = z
  .object({
    type: z.literal('http_collection'),
    name: fields.name
      .unwrap()
      .describe(
        'Complete literal user-supplied title, unchanged. Resolve ambiguity before calling this tool; choose a concise title only when none was supplied.',
      ),
  })
  .strict()

// One batch preserves folder dependencies and mixed-space creation. Each branch
// advertises only fields the corresponding storage actually supports.
export const workspaceCreationSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    items: z
      .array(
        z.discriminatedUnion('type', [note, snippet, http, folder, collection]),
      )
      .min(1)
      .max(30),
  })
  .strict()

export function creationPlan(input: unknown) {
  const parsed = workspaceCreationSchema.parse(input)
  return {
    summary: parsed.summary,
    operations: parsed.items.map((item) => {
      const { type, ...values } = item
      if (type === 'folder' && 'space' in values) {
        const { space, ...fields } = values
        return {
          space,
          kind: 'folder' as const,
          action: 'create' as const,
          fields,
        }
      }
      return {
        space:
          type === 'note'
            ? ('notes' as const)
            : type === 'snippet'
              ? ('code' as const)
              : ('http' as const),
        kind:
          type === 'http_collection' ? ('folder' as const) : ('item' as const),
        action: 'create' as const,
        fields: {
          ...values,
          ...(type === 'http_collection' ? { collection: true } : {}),
        },
      }
    }),
  }
}
