import { z } from 'zod'
import {
  aiPreferenceChangeSchema,
  aiPreferencesSnapshotSchema,
} from './aiNativePreferences'
import { HTTP_PREVIEW_TARGETS } from './httpPreview'

export const aiNativeTargetSchema = z.discriminatedUnion('space', [
  z
    .object({
      space: z.literal('code'),
      id: z.number().int().positive(),
      contentId: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({ space: z.literal('notes'), id: z.number().int().positive() })
    .strict(),
  z
    .object({ space: z.literal('http'), id: z.number().int().positive() })
    .strict(),
])
export type AiNativeTarget = z.infer<typeof aiNativeTargetSchema>
const noteInsertionLocation = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('afterText'),
      text: z.string().min(1).max(100000),
    })
    .strict(),
  z.object({ kind: z.enum(['start', 'end']) }).strict(),
])
const listScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('library'),
      filter: z.enum([
        'all',
        'inbox',
        'favorites',
        'trash',
        'tasks',
        'today',
        'upcoming',
        'completed',
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.enum(['folder', 'tag']),
      id: z.number().int().positive(),
    })
    .strict(),
  z.object({ kind: z.literal('clear') }).strict(),
])
const runnerResultSchema = z
  .object({
    runId: z.string(),
    folderId: z.number().int().positive(),
    folderName: z.string(),
    state: z.enum(['ready', 'running', 'passed', 'failed', 'cancelled']),
    steps: z.array(
      z
        .object({
          requestId: z.number().int().positive(),
          name: z.string(),
          state: z.enum([
            'pending',
            'running',
            'passed',
            'failed',
            'skipped',
            'cancelled',
          ]),
          status: z.number().nullable().optional(),
          durationMs: z.number().optional(),
        })
        .strict(),
    ),
  })
  .strict()
export const aiNativeActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('listQuery'),
      space: z.enum(['code', 'notes', 'http']),
      query: z.string().max(1000).optional(),
      scope: listScopeSchema.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('listSelection'),
      space: z.enum(['code', 'notes', 'http']),
      ids: z.array(z.number().int().positive()).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('httpOverview'),
      folderId: z.number().int().positive(),
      command: z.enum(['open', 'read']),
    })
    .strict(),
  z
    .object({
      action: z.literal('httpRunner'),
      command: z.enum(['open', 'read', 'stop']),
      folderId: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('chooseHttpFile'),
      target: aiNativeTargetSchema.options[2],
      field: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('binary') }).strict(),
        z
          .object({
            kind: z.literal('multipart'),
            index: z.number().int().min(0),
            key: z.string().max(10000),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal('enterHttpSecret'),
      target: aiNativeTargetSchema.options[2],
      environmentId: z.number().int().positive(),
      key: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({ action: z.literal('reveal'), target: aiNativeTargetSchema })
    .strict(),
  z
    .object({
      action: z.literal('themeAction'),
      command: z.enum(['openDirectory', 'createTemplate']),
    })
    .strict(),
  z.object({ action: z.literal('reload') }).strict(),
  z.object({ action: z.literal('cleanupCompletedTasks') }).strict(),
  z
    .object({
      action: z.literal('openDrawingEmbed'),
      target: aiNativeTargetSchema.options[1],
      drawingId: z.string().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('codePreview'),
      target: aiNativeTargetSchema.options[0],
      command: z.enum(['light', 'dark', 'refresh']),
    })
    .strict(),
  z
    .object({
      action: z.literal('httpDevtools'),
      target: aiNativeTargetSchema.options[2],
      command: z.enum([
        'consoleDetach',
        'consoleCopy',
        'terminalOpen',
        'terminalCreate',
        'terminalList',
        'terminalClear',
        'terminalClose',
      ]),
      sessionId: z.string().min(1).max(200).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('httpView'),
      target: aiNativeTargetSchema.options[2],
      panel: z.enum(['preview', 'responseBody', 'responseHeaders']),
      format: z
        .enum(
          HTTP_PREVIEW_TARGETS.flatMap(target =>
            target.clients.map(client => client.id),
          ),
        )
        .optional(),
      copy: z.boolean().default(false),
      interpolate: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('notesGraph'),
      command: z.discriminatedUnion('kind', [
        z.object({ kind: z.enum(['zoomIn', 'zoomOut', 'reset']) }).strict(),
        z
          .object({
            kind: z.literal('focus'),
            noteId: z.number().int().positive(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('moveNode'),
            noteId: z.number().int().positive(),
            dx: z.number().finite().min(-10000).max(10000),
            dy: z.number().finite().min(-10000).max(10000),
          })
          .strict(),
        z
          .object({
            kind: z.literal('pan'),
            x: z.number().min(-10000).max(10000),
            y: z.number().min(-10000).max(10000),
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal('codeImageConfigure'),
      target: aiNativeTargetSchema.options[0],
      theme: z.enum(['dark', 'light']).optional(),
      background: z.boolean().optional(),
      gradient: z
        .enum(['disco', 'aqua', 'salad', 'cucumber', 'lovely'])
        .optional(),
      width: z.number().int().positive().max(10000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('jsonVisualizer'),
      target: aiNativeTargetSchema.options[0],
      command: z.enum([
        'zoomIn',
        'zoomOut',
        'fit',
        'lock',
        'unlock',
        'showNode',
        'copyNode',
      ]),
      pointer: z.string().max(10000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('mindmap'),
      target: aiNativeTargetSchema.options[1],
      command: z.enum(['zoomIn', 'zoomOut', 'fit', 'collapse', 'expand']),
      nodeText: z.string().min(1).max(1000).optional(),
    })
    .strict(),

  z
    .object({
      action: z.literal('readFolderIcons'),
      query: z.string().max(1000).default(''),
      offset: z.number().int().min(0).default(0),
    })
    .strict(),
  z
    .object({
      action: z.literal('folderIcon'),
      space: z.enum(['code', 'notes', 'http']),
      folderId: z.number().int().positive(),
      choice: z.discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('icon'),
            value: z.string().min(1).max(256).nullable(),
          })
          .strict(),
        z.object({ kind: z.literal('image') }).strict(),
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal('storage'),
      command: z.enum([
        'select',
        'move',
        'migrateSqlite',
        'doctorScan',
        'doctorApply',
      ]),
    })
    .strict(),
  z.object({ action: z.literal('configureAi') }).strict(),
  z
    .object({
      action: z.literal('readDrawings'),
      query: z.string().max(1000).default(''),
      offset: z.number().int().min(0).default(0),
    })
    .strict(),
  z
    .object({
      action: z.literal('insertDrawing'),
      target: aiNativeTargetSchema.options[1],
      drawingId: z.string().min(1).max(1000),
      alt: z.string().max(1000),
      location: noteInsertionLocation,
    })
    .strict(),
  z
    .object({
      action: z.literal('notesSection'),
      target: aiNativeTargetSchema.options[1],
      heading: z.string().min(1).max(1000),
      destination: z
        .object({
          heading: z.string().min(1).max(1000),
          placement: z.enum(['before', 'after', 'inside']),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('presentation'),
      target: aiNativeTargetSchema.options[1],
      command: z.enum([
        'previous',
        'next',
        'close',
        'fullscreenOn',
        'fullscreenOff',
        'laserOn',
        'laserOff',
        'zoomIn',
        'zoomOut',
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal('httpPanel'),
      target: aiNativeTargetSchema.options[2],
      panel: z.enum([
        'params',
        'headers',
        'body',
        'auth',
        'description',
        'assertions',
        'variables',
        'scripts',
        'settings',
        'message',
        'preview',
        'response',
        'responseBody',
        'responseHeaders',
        'responseTests',
        'history',
        'console',
        'terminal',
        'cookies',
        'environments',
        'inspector',
      ]),
      visible: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      action: z.literal('notesLibrary'),
      filter: z.enum(['tasks', 'today', 'upcoming', 'completed']),
    })
    .strict(),
  z
    .object({
      action: z.literal('notesReveal'),
      target: aiNativeTargetSchema.options[1],
      kind: z.enum(['heading', 'annotation', 'internalLink', 'externalLink']),
      value: z.string().min(1).max(10000),
      occurrence: z.number().int().min(1).default(1),
    })
    .strict(),
  z
    .object({
      action: z.literal('httpDock'),
      target: aiNativeTargetSchema.options[2],
      maximized: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('notesPage'),
      page: z.enum(['dashboard', 'graph']),
    })
    .strict(),
  z.object({ action: z.literal('readNotesDashboard') }).strict(),
  z
    .object({
      action: z.literal('notesInspector'),
      target: aiNativeTargetSchema.options[1],
      visible: z.boolean(),
      tab: z.enum(['outline', 'links', 'annotations']),
    })
    .strict(),
  z
    .object({
      action: z.literal('listView'),
      space: z.enum(['code', 'notes', 'http']),
      sort: z.enum(['createdAt', 'updatedAt', 'name']).optional(),
      order: z.enum(['ASC', 'DESC']).optional(),
      compact: z.boolean().optional(),
      hideCompleted: z.boolean().optional(),
      createKind: z.enum(['note', 'task']).optional(),
      layout: z.enum(['all-panels', 'list-editor', 'editor-only']).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('editorCommand'),
      target: aiNativeTargetSchema.options[1],
      command: z.enum([
        'bold',
        'italic',
        'strikethrough',
        'highlight',
        'code',
        'link',
        'clear-formatting',
        'bullet-list',
        'numbered-list',
        'task-list',
        'heading-1',
        'heading-2',
        'heading-3',
        'heading-4',
        'heading-5',
        'heading-6',
        'body',
        'quote',
        'table',
        'callout',
        'horizontal-rule',
        'code-block',
        'normalizeLineBreaks',
      ]),
      location: z.discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('text'),
            text: z.string().min(1).max(100000),
          })
          .strict(),
        z.object({ kind: z.enum(['start', 'end', 'document']) }).strict(),
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal('insertNoteImage'),
      source: z.enum(['picker', 'clipboardImage']).optional(),
      target: aiNativeTargetSchema.options[1],
      alt: z.string().max(1000),
      location: noteInsertionLocation,
    })
    .strict(),
  z.object({ action: z.literal('readPreferences') }).strict(),
  z
    .object({
      action: z.literal('setPreferences'),
      change: aiPreferenceChangeSchema,
    })
    .strict(),
  z
    .object({ action: z.literal('navigate'), target: aiNativeTargetSchema })
    .strict(),
  z
    .object({
      action: z.literal('history'),
      direction: z.enum(['back', 'forward']),
    })
    .strict(),
  z
    .object({
      action: z.literal('openSpace'),
      space: z.enum(['code', 'notes', 'http']),
    })
    .strict(),
  z
    .object({
      action: z.literal('copy'),
      target: aiNativeTargetSchema,
      part: z.enum(['content', 'title', 'link', 'url']),
    })
    .strict(),
  z
    .object({
      action: z.literal('setView'),
      target: aiNativeTargetSchema,
      view: z.enum([
        'editor',
        'codeImage',
        'jsonVisualizer',
        'codePreview',
        'raw',
        'livePreview',
        'preview',
        'mindmap',
        'presentation',
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal('findInContent'),
      target: aiNativeTargetSchema,
      query: z.string().min(1).max(1000).optional(),
      command: z.enum(['search', 'next', 'previous', 'close']).optional(),
    })
    .strict(),
  z
    .object({ action: z.literal('format'), target: aiNativeTargetSchema })
    .strict(),
  z
    .object({
      action: z.literal('exportView'),
      target: aiNativeTargetSchema,
      view: z.enum(['codeImage', 'jsonVisualizer', 'codePreview', 'mindmap']),
      format: z.enum(['png', 'svg', 'html']),
    })
    .strict(),
])
export type AiNativeAction = z.infer<typeof aiNativeActionSchema>
export function isBoundaryNativeAction(action?: AiNativeAction) {
  return (
    action?.action === 'reload'
    || action?.action === 'configureAi'
    || (action?.action === 'storage' && action.command !== 'doctorScan')
  )
}
export const aiNativeRequestSchema = z
  .object({
    summary: z.string().trim().min(1).max(1000),
    operation: aiNativeActionSchema,
  })
  .strict()
export interface AiNativeState {
  space?: 'code' | 'notes' | 'http'
  target?: AiNativeTarget
  selectedIds: number[]
  view?: string
  canGoBack: boolean
  canGoForward: boolean
}
export const aiNativeResultSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['done', 'cancelled', 'stale', 'unavailable', 'failed']),
    list: z
      .object({
        query: z.string(),
        scope: listScopeSchema,
        count: z.number().int().min(0),
        selectedIds: z.array(z.number().int().positive()),
      })
      .strict()
      .optional(),
    runner: runnerResultSchema.optional(),
    overview: z
      .object({
        folderId: z.number().int().positive(),
        requests: z.number().int(),
        folders: z.number().int(),
        methods: z.array(
          z.object({ method: z.string(), count: z.number().int() }).strict(),
        ),
        recent: z.array(
          z
            .object({
              id: z.number(),
              requestId: z.number(),
              name: z.string(),
              requestedAt: z.number(),
              status: z.number().nullable(),
            })
            .strict(),
        ),
        lastRun: runnerResultSchema.nullable(),
      })
      .strict()
      .optional(),
    persisted: z.boolean().optional(),
    reloadRequired: z.boolean().optional(),
    reloadRequested: z.boolean().optional(),
    secret: z
      .object({
        environmentId: z.number().int().positive(),
        key: z.string(),
        present: z.boolean(),
        saved: z.boolean(),
      })
      .strict()
      .optional(),
    count: z.number().int().min(0).optional(),
    terminals: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            active: z.boolean(),
            exitCode: z.number().optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    preferences: aiPreferencesSnapshotSchema.optional(),
    availableThemes: z.array(z.string().max(200)).max(1000).optional(),
    availableLocales: z.array(z.string().max(20)).max(100).optional(),
    panel: z.string().max(100).optional(),
    search: z
      .object({
        open: z.boolean(),
        index: z.number().int().min(-1),
        count: z.number().int().min(0),
      })
      .strict()
      .optional(),
    dashboard: z
      .object({
        stats: z
          .object({
            notesCount: z.number(),
            wordsCount: z.number(),
            foldersCount: z.number(),
            tagsCount: z.number(),
          })
          .strict(),
        activity: z
          .object({
            days: z.record(z.string(), z.number()),
            notesUpdatedToday: z.number(),
            notesUpdatedLast7Days: z.number(),
          })
          .strict(),
        recent: z.array(
          z
            .object({
              id: z.number(),
              name: z.string(),
              folder: z
                .object({ id: z.number(), name: z.string() })
                .strict()
                .nullable(),
              updatedAt: z.number(),
            })
            .strict(),
        ),
        topLinked: z.array(
          z
            .object({
              id: z.number(),
              name: z.string(),
              incomingLinksCount: z.number(),
            })
            .strict(),
        ),
        heatmap: z
          .object({
            from: z.string(),
            to: z.string(),
            count: z.number().int(),
            totalUpdates: z.number(),
          })
          .strict(),
      })
      .strict()
      .optional(),
    characters: z.number().int().min(0).optional(),
    filePath: z.string().max(8192).optional(),
    bytes: z.number().int().min(0).optional(),
    drawings: z
      .array(
        z
          .object({ id: z.string().max(1000), name: z.string().max(1000) })
          .strict(),
      )
      .max(100)
      .optional(),
    icons: z
      .array(
        z
          .object({ value: z.string().max(256), name: z.string().max(1000) })
          .strict(),
      )
      .max(100)
      .optional(),
    total: z.number().int().min(0).optional(),
    visual: z
      .object({
        theme: z.enum(['dark', 'light']).optional(),
        background: z.boolean().optional(),
        gradient: z.string().max(100).optional(),
        width: z.number().optional(),
        locked: z.boolean().optional(),
      })
      .strict()
      .optional(),
    presentation: z
      .object({
        index: z.number().int(),
        count: z.number().int(),
        fullscreen: z.boolean(),
        laser: z.boolean(),
        scale: z.string(),
      })
      .strict()
      .optional(),
    storage: z
      .object({
        operationCompleted: z.boolean(),
        activeVaultChanged: z.boolean(),
        refreshCompleted: z.boolean(),
        changesMayHaveOccurred: z.boolean().optional(),
        folders: z.number().int().min(0).optional(),
        snippets: z.number().int().min(0).optional(),
        tags: z.number().int().min(0).optional(),
        applied: z.number().int().min(0).optional(),
        blocked: z.number().int().min(0).optional(),
        conflicts: z.number().int().min(0).optional(),
        warnings: z.number().int().min(0).optional(),
        affectedFiles: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
    profile: z
      .object({
        provider: z.string().max(100),
        model: z.string().max(1000),
        saved: z.boolean(),
        connectionCheck: z.enum(['passed', 'failed', 'notRun']),
      })
      .strict()
      .optional(),
    target: aiNativeTargetSchema.optional(),
    state: z
      .object({
        space: z.enum(['code', 'notes', 'http']).optional(),
        target: aiNativeTargetSchema.optional(),
        selectedIds: z.array(z.number().int().positive()).max(1000),
        view: z.string().max(100).optional(),
        canGoBack: z.boolean(),
        canGoForward: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
export type AiNativeResult = z.infer<typeof aiNativeResultSchema>
export interface AiNativeActionView {
  id: string
  summary: string
  operation?: AiNativeAction
  status: 'pending' | 'running' | AiNativeResult['status']
  result?: AiNativeResult
}
export const nativeTools = [
  {
    type: 'function',
    function: {
      name: 'read_native_state',
      description:
        'Read the current native workspace, selected IDs, fragment, view and navigation availability. No clipboard, DOM or secrets.',
      parameters: z.toJSONSchema(z.object({}).strict()),
    },
  },
  {
    type: 'function',
    function: {
      name: 'perform_native_action',
      description:
        'Perform an existing native application action for an explicit user task. listQuery changes the displayed list query/scope; scope clear clears search and restores the pre-search scope/selection, library all clears library filtering; listSelection accepts only exact IDs currently displayed (empty clears selection), never invent IDs. HTTP navigation waits for native Save/Discard/Cancel. httpOverview open navigates to the exact folder; read returns the same overview without navigation. httpRunner open requires folderId and only prepares the native runner, never sends requests; read returns current metadata; stop waits for actual terminal status and may finish passed/failed if completion wins the race. Use exact target IDs. copy content reads the current editor for that target; other targets must first be opened. Native export asks for a destination and waits for the actual saved file. readPreferences reads only allowed non-secret settings and available themes/locales. setPreferences updates only requested fields, preserves other settings and verifies persistence. Dashboard widget visibility is included in setPreferences. Locale takes effect on reload; do not claim the app has reloaded. Use setView before codeImageConfigure/jsonVisualizer/mindmap; controls require that exact view to be mounted. mindmap collapse/expand uses an optional unique visible nodeText, or the root when omitted. notesGraph requires notesPage(graph) first and exact note IDs to focus neighbors or moveNode by bounded dx/dy graph coordinates; movement is temporary and never opens the note. httpView shows or copies actual preview/response text; format applies only to preview. Clipboard contents are never returned. httpDevtools manages console and terminal UI; it cannot input or run shell commands. Storage select/move/migrate/doctorApply and configureAi are terminal handoffs: the user chooses paths, secrets and conflicts in native UI. Their receipt ends this task and invalidates the old context; do not batch further work after them. A saved AI profile and a successful connection check are separate facts. Migration replaces vault contents. readFolderIcons returns supported builtin identifiers, folderIcon also accepts emoji or the native image picker. insertNoteImage source defaults to picker; clipboardImage reads only the native clipboard image and never text or bytes; insertDrawing requires a verified existing drawing ID. findInContent commands search/next/previous/close return zero-based current index (-1 when absent) and actual match count; query is required for search only. notesSection with destination moves the complete heading section and descendants, including trailing blocks, in raw/livePreview; source and destination headings must each be unique. notesReveal uses a typed heading title, exact annotation text, internal link target or external URL and one-based occurrence, never source offsets. notesLibrary opens the actual Tasks/Today/Upcoming/Completed list. listView createKind is notes-only and persists the default note/task creation kind with Undo. httpDock maximizes/restores the existing open HTTP dock. readNotesDashboard reads real statistics/activity/recent/topLinked and the exact displayed heatmap range without navigation or writes; use it for analysis-only requests. Activity buckets count nondeleted notes by their current updatedAt, not a history of save events. notesPage dashboard opens the page and returns the same data. chooseHttpFile uses the native picker for binary or an exact multipart index+key; it changes only the draft, never saves or sends, and exposes no path. enterHttpSecret opens the existing environment editor for local user entry, waits for successful encrypted persistence, and never receives secret values. Cancellation/failure blocks dependent work. jsonVisualizer showNode/copyNode take an RFC6901 pointer to a rendered object/array subtree (empty string means root); no arbitrary clipboard text. reveal opens the exact item in the file manager; themeAction uses the native themes folder/template actions. reload is a terminal handoff: its receipt only confirms a reload request, never the new process. cleanupCompletedTasks uses the native confirmation and cleans all completed tasks. listView hideCompleted is notes-only. openDrawingEmbed requires an actual image embed in the current source note and an existing drawing. codePreview controls light/dark/refresh on the mounted view and always requires confirmation. httpView interpolate controls preview variable interpolation. terminalList returns only session metadata; terminalCreate creates a native terminal without entering commands. Opening Code Preview executes its sandboxed code and requires explicit confirmation.',
      parameters: z.toJSONSchema(aiNativeRequestSchema, { io: 'input' }),
    },
  },
]
