import { beforeEach, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'

const mock = vi.hoisted(() => ({
  data: {} as Record<string, Record<string, unknown>>,
  fail: false,
  themes: [{ id: 'custom' }],
}))
vi.mock('@/router', () => ({ router: {}, RouterName: {} }))
vi.mock('@/services/api', () => ({ api: {} }))
vi.mock('@/electron', () => ({
  store: {
    app: {
      get: (key: string) => mock.data[key],
      set: (key: string, value: Record<string, unknown>) => {
        if (!mock.fail)
          mock.data[key] = JSON.parse(JSON.stringify(value))
      },
    },
    preferences: {
      get: (key: string) => JSON.parse(JSON.stringify(mock.data[key] ?? {})),
      set: (key: string, value: Record<string, unknown>) => {
        if (!mock.fail)
          mock.data[key] = JSON.parse(JSON.stringify(value))
      },
    },
  },
}))
vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    loadCustomThemes: async () => {},
    customThemes: { value: mock.themes },
    setTheme: async (theme: string) => {
      mock.data.appearance.theme = theme
    },
  }),
}))
vi.mock('@/composables/useDateFormat', () => ({
  useDateFormat: () => ({
    setDateFormat: (dateFormat: string) => {
      mock.data.appearance.dateFormat = dateFormat
    },
  }),
}))
vi.mock('@/composables/useDockBadgePreference', () => ({
  useDockBadgePreference: () => ({
    setSource: async (dockBadgeSource: string) => {
      mock.data.appearance.dockBadgeSource = dockBadgeSource
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('computed', computed)
  mock.fail = false
  mock.data = {
    'editor.code': { fontSize: 14, wrap: false },
    'editor.notes': { fontSize: 16, lineHeight: 1.54 },
    'http': { transport: { timeoutMs: 30000, maxRedirects: 5 }, wrapLines: true },
    'appearance': { theme: 'auto', dateFormat: 'locale' },
    'tasks': { autoCleanupCompleted: 'never' },
    'localization': { locale: 'en_US' },
    'ai': { apiKey: 'DO NOT EXPOSE' },
  }
})
it('reads only allowed settings, applies native watchers and verifies saved values', async () => {
  const { readNativePreferences, setNativePreferences } = await import(
    '../nativePreferences'
  )
  expect(JSON.stringify(await readNativePreferences())).not.toContain(
    'DO NOT EXPOSE',
  )
  const result = await setNativePreferences(
    { group: 'http', values: { transport: { timeoutMs: 5000 } } },
    () => true,
  )
  expect(result).toMatchObject({
    status: 'done',
    persisted: true,
    mutation: { kind: 'preferences' },
  })
  expect(mock.data.http.transport).toEqual({
    timeoutMs: 5000,
    maxRedirects: 5,
  })
})
it('preserves subsequent manual edits during partial Undo and does not replay restored fields', async () => {
  const { setNativePreferences, undoNativePreferences } = await import(
    '../nativePreferences'
  )
  const { settings } = await import(
    '@/composables/spaces/http/useHttpSettings'
  ).then(module => module.useHttpSettings())
  const result = await setNativePreferences(
    {
      group: 'http',
      values: { transport: { timeoutMs: 5000, maxRedirects: 2 } },
    },
    () => true,
  )
  if (result.mutation?.kind !== 'preferences')
    throw new Error('missing receipt')
  settings.transport!.timeoutMs = 1000
  await nextTick()
  expect(await undoNativePreferences(result.mutation)).toEqual([
    'http.transport.timeoutMs',
  ])
  expect(mock.data.http.transport).toEqual({
    timeoutMs: 1000,
    maxRedirects: 5,
  })
  settings.transport!.maxRedirects = 9
  await nextTick()
  expect(await undoNativePreferences(result.mutation)).toEqual([
    'http.transport.timeoutMs',
  ])
  expect(mock.data.http.transport).toEqual({
    timeoutMs: 1000,
    maxRedirects: 9,
  })
})
it('does not claim success for stale tasks, invalid choices or a failed persistence readback', async () => {
  const { setNativePreferences } = await import('../nativePreferences')
  expect(
    await setNativePreferences(
      { group: 'appearance', values: { theme: 'missing' } },
      () => true,
    ),
  ).toEqual({ status: 'unavailable' })
  expect(
    await setNativePreferences(
      { group: 'code', values: { fontSize: 18 } },
      () => false,
    ),
  ).toEqual({ status: 'stale' })
  mock.fail = true
  expect(
    await setNativePreferences(
      { group: 'code', values: { fontSize: 18 } },
      () => true,
    ),
  ).toMatchObject({ status: 'failed', persisted: false })
  expect(mock.data['editor.code'].fontSize).toBe(14)
  const { settings } = await import('@/composables/useEditor').then(module =>
    module.useEditor(),
  )
  expect(settings.fontSize).toBe(14)
  mock.fail = false
  settings.wrap = true
  await nextTick()
  expect(mock.data['editor.code']).toEqual({ fontSize: 14, wrap: true })
})
it('rejects unknown settings and invalid locales before changing preferences', async () => {
  const { aiPreferenceChangeSchema } = await import(
    '~/shared/aiNativePreferences'
  )
  const { setNativePreferences } = await import('../nativePreferences')
  expect(
    aiPreferenceChangeSchema.safeParse({
      group: 'http',
      values: { apiKey: 'secret' },
    }).success,
  ).toBe(false)
  expect(
    await setNativePreferences(
      { group: 'localization', values: { locale: 'zz_ZZ' } },
      () => true,
    ),
  ).toEqual({ status: 'unavailable' })
})

it('undo removes newly added optional transport fields without retaining their AI values', async () => {
  const { setNativePreferences, undoNativePreferences } = await import(
    '../nativePreferences'
  )
  const result = await setNativePreferences(
    { group: 'http', values: { transport: { protocolVersion: 'http2' } } },
    () => true,
  )
  if (result.mutation?.kind !== 'preferences')
    throw new Error('missing receipt')
  expect(await undoNativePreferences(result.mutation)).toEqual([])
  expect(mock.data.http.transport).toEqual({
    timeoutMs: 30000,
    maxRedirects: 5,
  })
})

it('persists dashboard visibility, retains defaults and preserves a manually changed widget on Undo', async () => {
  const { setNativePreferences, undoNativePreferences } = await import(
    '../nativePreferences'
  )
  const { dashboardWidgets } = (
    await import('@/composables/spaces/notes/useNotesDashboard')
  ).useNotesDashboard()
  const result = await setNativePreferences(
    { group: 'dashboard', values: { stats: false, recent: false } },
    () => true,
  )
  expect(result).toMatchObject({ status: 'done', persisted: true })
  expect(mock.data['notes.dashboard.widgets']).toMatchObject({
    stats: false,
    recent: false,
    topLinked: true,
  })
  dashboardWidgets.value.stats = true
  await nextTick()
  if (result.mutation?.kind !== 'preferences')
    throw new Error('missing receipt')
  expect(await undoNativePreferences(result.mutation)).toEqual([
    'dashboard.stats',
  ])
  expect(dashboardWidgets.value.recent).toBe(true)
})

it('persists the native creation kind and undoes only its own value', async () => {
  const { setNativePreferences, undoNativePreferences } = await import(
    '../nativePreferences'
  )
  const { useNotesApp } = await import(
    '@/composables/spaces/notes/useNotesApp'
  )
  const result = await setNativePreferences(
    { group: 'notesCreation', values: { kind: 'task' } },
    () => true,
  )
  expect(result).toMatchObject({ status: 'done', persisted: true })
  expect(useNotesApp().notesCreateKind.value).toBe('task')
  expect(mock.data['notes.create.kind']).toBe('task')
  if (result.mutation?.kind !== 'preferences')
    throw new Error('missing receipt')
  expect(await undoNativePreferences(result.mutation)).toEqual([])
  expect(useNotesApp().notesCreateKind.value).toBe('note')
  expect(mock.data['notes.create.kind']).toBe('note')
})
