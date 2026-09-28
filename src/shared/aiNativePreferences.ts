import { z } from 'zod'
import { DATE_FORMATS } from './dateFormat'
import { HTTP_HISTORY_LIMITS } from './httpHistory'
import { HTTP_PREVIEW_TARGETS } from './httpPreview'
import { httpTransportSchema } from './httpTransport'

const font = z.string().max(500)
const previewFormats = HTTP_PREVIEW_TARGETS.flatMap(target =>
  target.clients.map(client => client.id),
)
export const aiPreferenceSchemas = {
  notesCreation: z
    .object({ kind: z.enum(['note', 'task']) })
    .partial()
    .strict(),
  dashboard: z
    .object({
      stats: z.boolean(),
      activityHeatmap: z.boolean(),
      recent: z.boolean(),
      graphPreview: z.boolean(),
      topLinked: z.boolean(),
    })
    .partial()
    .strict(),
  code: z
    .object({
      fontSize: z.number().min(1),
      fontFamily: font,
      wrap: z.boolean(),
      tabSize: z.number().int().min(1),
      trailingComma: z.enum(['all', 'none', 'es5']),
      semi: z.boolean(),
      singleQuote: z.boolean(),
      highlightLine: z.boolean(),
      matchBrackets: z.boolean(),
    })
    .partial()
    .strict(),
  notes: z
    .object({
      fontSize: z.number().min(1),
      fontFamily: font,
      codeFontFamily: font,
      lineHeight: z.union([z.literal(1.4), z.literal(1.54), z.literal(1.7)]),
      indentSize: z.number().int().min(1),
      limitWidth: z.boolean(),
      wrapTables: z.boolean(),
      lineNumbers: z.boolean(),
    })
    .partial()
    .strict(),
  http: z
    .object({
      transport: httpTransportSchema.strict(),
      skipCertificateVerification: z.boolean(),
      wrapLines: z.boolean(),
      autoSwitchToResponse: z.boolean(),
      historyLimit: z.union(
        HTTP_HISTORY_LIMITS.map(value => z.literal(value)),
      ),
      defaultPreviewFormat: z.enum(previewFormats),
    })
    .partial()
    .strict(),
  appearance: z
    .object({
      theme: z.string().min(1).max(200),
      dateFormat: z.enum(DATE_FORMATS),
      dockBadgeSource: z.enum(['none', 'codeInbox', 'notesInbox', 'tasksDue']),
    })
    .partial()
    .strict(),
  tasks: z
    .object({ autoCleanupCompleted: z.enum(['never', '1d', '7d', '30d']) })
    .partial()
    .strict(),
  localization: z
    .object({ locale: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/) })
    .partial()
    .strict(),
}
export type AiPreferenceGroup = keyof typeof aiPreferenceSchemas
export const aiPreferenceChangeSchema = z
  .discriminatedUnion('group', [
    z
      .object({
        group: z.literal('notesCreation'),
        values: aiPreferenceSchemas.notesCreation,
      })
      .strict(),
    z
      .object({
        group: z.literal('dashboard'),
        values: aiPreferenceSchemas.dashboard,
      })
      .strict(),
    z
      .object({ group: z.literal('code'), values: aiPreferenceSchemas.code })
      .strict(),
    z
      .object({ group: z.literal('notes'), values: aiPreferenceSchemas.notes })
      .strict(),
    z
      .object({ group: z.literal('http'), values: aiPreferenceSchemas.http })
      .strict(),
    z
      .object({
        group: z.literal('appearance'),
        values: aiPreferenceSchemas.appearance,
      })
      .strict(),
    z
      .object({ group: z.literal('tasks'), values: aiPreferenceSchemas.tasks })
      .strict(),
    z
      .object({
        group: z.literal('localization'),
        values: aiPreferenceSchemas.localization,
      })
      .strict(),
  ])
  .refine(change => Object.keys(change.values).length > 0)
export type AiPreferenceChange = z.infer<typeof aiPreferenceChangeSchema>
export const aiPreferencesSnapshotSchema = z
  .object({
    notesCreation: aiPreferenceSchemas.notesCreation,
    dashboard: aiPreferenceSchemas.dashboard,
    code: aiPreferenceSchemas.code,
    notes: aiPreferenceSchemas.notes,
    http: aiPreferenceSchemas.http,
    appearance: aiPreferenceSchemas.appearance,
    tasks: aiPreferenceSchemas.tasks,
    localization: aiPreferenceSchemas.localization,
  })
  .partial()
  .strict()
export type AiPreferencesSnapshot = z.infer<typeof aiPreferencesSnapshotSchema>
export interface NativePreferenceMutation {
  kind: 'preferences'
  group: AiPreferenceGroup
  before: Record<string, unknown>
  after: Record<string, unknown>
  undone?: boolean
}
