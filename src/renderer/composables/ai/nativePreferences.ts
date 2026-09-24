import type { NativeBridgeResult } from './nativeBridges'
import type {
  AiPreferenceChange,
  AiPreferenceGroup,
  AiPreferencesSnapshot,
  NativePreferenceMutation,
} from '~/shared/aiNativePreferences'
import { useHttpSettings } from '@/composables/spaces/http/useHttpSettings'
import { useNotesApp } from '@/composables/spaces/notes/useNotesApp'
import {
  DEFAULT_WIDGETS,
  useNotesDashboard,
} from '@/composables/spaces/notes/useNotesDashboard'
import { useDateFormat } from '@/composables/useDateFormat'
import { useDockBadgePreference } from '@/composables/useDockBadgePreference'
import { useEditor } from '@/composables/useEditor'
import { useLocalePreference } from '@/composables/useLocalePreference'
import { useNotesEditor } from '@/composables/useNotesEditor'
import { useTaskPreferences } from '@/composables/useTaskPreferences'
import { useTheme } from '@/composables/useTheme'
import { store } from '@/electron'
import { language } from '~/main/i18n/language'
import {
  aiPreferenceChangeSchema,
  aiPreferenceSchemas,
} from '~/shared/aiNativePreferences'
import { applyAiPatch, inverseAiPatch } from '~/shared/aiUndo'

const keys = {
  notesCreation: 'notes.create',
  dashboard: 'notes.dashboard.widgets',
  code: 'editor.code',
  notes: 'editor.notes',
  http: 'http',
  appearance: 'appearance',
  tasks: 'tasks',
  localization: 'localization',
} as const
function saved(group: AiPreferenceGroup): Record<string, unknown> {
  if (group === 'notesCreation')
    return { kind: store.app.get('notes.create.kind') ?? 'note' }
  const value
    = group === 'dashboard'
      ? {
          ...DEFAULT_WIDGETS,
          ...store.app.get<Record<string, unknown>>(keys[group]),
        }
      : (store.preferences.get<Record<string, unknown>>(keys[group]) ?? {})
  // Never pass arbitrary preference fields (credentials, paths, providers) to AI.
  return aiPreferenceSchemas[group].parse(
    Object.fromEntries(
      Object.keys(aiPreferenceSchemas[group].shape)
        .filter(key => value[key] !== undefined)
        .map(key => [key, value[key]]),
    ),
  )
}
export async function readNativePreferences(): Promise<NativeBridgeResult> {
  const theme = useTheme()
  await theme.loadCustomThemes()
  const preferences = Object.fromEntries(
    Object.keys(keys).map(group => [
      group,
      saved(group as AiPreferenceGroup),
    ]),
  ) as AiPreferencesSnapshot
  return {
    status: 'done',
    preferences,
    availableThemes: [
      'auto',
      'light',
      'dark',
      ...theme.customThemes.value.map(item => item.id),
    ],
    availableLocales: Object.keys(language),
  }
}

function live(group: AiPreferenceGroup): Record<string, unknown> {
  if (group === 'notesCreation')
    return { kind: useNotesApp().notesCreateKind.value }
  if (group === 'dashboard') {
    return useNotesDashboard().dashboardWidgets.value as unknown as Record<
      string,
      unknown
    >
  }
  if (group === 'appearance') {
    return {
      theme: useTheme().currentThemeId.value,
      dateFormat: useDateFormat().dateFormat.value,
      dockBadgeSource: useDockBadgePreference().source.value,
    }
  }
  if (group === 'localization')
    return { locale: useLocalePreference().locale.value }
  return (group === 'code'
    ? useEditor().settings
    : group === 'notes'
      ? useNotesEditor().settings
      : group === 'http'
        ? useHttpSettings().settings
        : useTaskPreferences().settings) as unknown as Record<string, unknown>
}

async function write(change: AiPreferenceChange, replace = false) {
  if (change.group === 'notesCreation') {
    if (change.values.kind)
      useNotesApp().notesCreateKind.value = change.values.kind
  }
  else if (change.group === 'dashboard') {
    Object.assign(useNotesDashboard().dashboardWidgets.value, change.values)
  }
  else if (change.group === 'appearance') {
    const values = change.values
    if (values.theme !== undefined)
      await useTheme().setTheme(values.theme)
    if (values.dateFormat !== undefined)
      useDateFormat().setDateFormat(values.dateFormat)
    if (values.dockBadgeSource !== undefined)
      await useDockBadgePreference().setSource(values.dockBadgeSource)
  }
  else if (change.group === 'localization') {
    if (change.values.locale !== undefined)
      useLocalePreference().locale.value = change.values.locale
  }
  else {
    const settings
      = change.group === 'code'
        ? useEditor().settings
        : change.group === 'notes'
          ? useNotesEditor().settings
          : change.group === 'http'
            ? useHttpSettings().settings
            : useTaskPreferences().settings
    if (replace) {
      for (const [key, value] of Object.entries(change.values)) {
        if (value === undefined)
          delete (settings as unknown as Record<string, unknown>)[key]
        else Object.assign(settings, { [key]: value })
      }
    }
    else {
      Object.assign(
        settings,
        applyAiPatch(
          settings as unknown as Record<string, unknown>,
          change.values,
        ),
      )
    }
  }
  // Existing synchronous electron-store watchers run before nextTick resolves.
  await nextTick()
}
function touched(
  value: Record<string, unknown>,
  requested: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.keys(requested).map(key => [key, value[key]]),
  )
}
export async function setNativePreferences(
  input: AiPreferenceChange,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  const change = aiPreferenceChangeSchema.parse(input)
  if (
    change.group === 'localization'
    && change.values.locale
    && !Object.hasOwn(language, change.values.locale)
  ) {
    return { status: 'unavailable' }
  }
  if (
    change.group === 'appearance'
    && change.values.theme
    && !['auto', 'light', 'dark'].includes(change.values.theme)
  ) {
    const theme = useTheme()
    await theme.loadCustomThemes()
    if (
      !theme.customThemes.value.some(item => item.id === change.values.theme)
    )
      return { status: 'unavailable' }
  }
  if (!current())
    return { status: 'stale' }
  const before = saved(change.group)
  const expected = applyAiPatch(before, change.values)
  let failed = false
  try {
    await write(change)
  }
  catch {
    failed = true
  }
  let after = saved(change.group)
  const persisted = Object.keys(change.values).every(
    key => JSON.stringify(after[key]) === JSON.stringify(expected[key]),
  )
  if (failed || !persisted) {
    // Restore only our still-present unsaved leaves. A concurrent manual edit
    // differs from expected and must remain in the native settings object.
    const actual = live(change.group)
    const inverse = inverseAiPatch(
      touched(after, change.values),
      touched(expected, change.values),
      actual,
    )
    if (Object.keys(inverse.patch).length) {
      const restored = applyAiPatch(actual, inverse.patch)
      try {
        await write(
          aiPreferenceChangeSchema.parse({
            group: change.group,
            values: touched(restored, inverse.patch),
          }),
          true,
        )
      }
      catch {
        // The reactive rollback precedes its persistence watcher.
      }
    }
    after = saved(change.group)
  }
  const mutation: NativePreferenceMutation = {
    kind: 'preferences',
    group: change.group,
    before: touched(before, change.values),
    after: touched(after, change.values),
  }
  return {
    status: !failed && persisted ? 'done' : 'failed',
    persisted,
    reloadRequired: change.group === 'localization' && persisted,
    preferences: { [change.group]: after },
    mutation:
      JSON.stringify(mutation.before) !== JSON.stringify(mutation.after)
        ? mutation
        : undefined,
  }
}
export async function undoNativePreferences(receipt: NativePreferenceMutation) {
  const current = saved(receipt.group)
  const inverse = inverseAiPatch(receipt.before, receipt.after, current)
  if (Object.keys(inverse.patch).length) {
    // Nested inverse values must merge with fresh siblings before schema validation.
    const restored = applyAiPatch(current, inverse.patch)
    const values = touched(restored, inverse.patch)
    await write(
      aiPreferenceChangeSchema.parse({ group: receipt.group, values }),
      true,
    )
    const actual = saved(receipt.group)
    if (
      !Object.keys(values).every(
        key => JSON.stringify(actual[key]) === JSON.stringify(values[key]),
      )
    ) {
      throw new Error('preferences')
    }
  }
  receipt.before = inverse.remainingBefore
  receipt.after = inverse.remainingAfter
  receipt.undone = !inverse.conflicts.length
  return inverse.conflicts.map(key => `${receipt.group}.${key}`)
}
