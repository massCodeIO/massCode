import type { AiPreferenceChange } from '~/shared/aiNativePreferences'
import { i18n } from '@/electron'

export function preferenceReview(change: AiPreferenceChange) {
  const groups = {
    notesCreation: 'notesCreation',
    dashboard: 'notes.dashboard',
    code: 'editor',
    notes: 'notesEditor',
    http: 'http',
    appearance: 'appearance',
    tasks: 'tasks',
    localization: 'language',
  }
  if (change.group === 'notesCreation') {
    return {
      label: i18n.t('ai.native.createKind'),
      rows: [
        {
          label: i18n.t('ai.native.createKind'),
          value: i18n.t(`ai.native.createKinds.${change.values.kind}`),
        },
      ],
      sensitive: false,
    }
  }
  const group = groups[change.group]
  const rows = Object.entries(change.values).flatMap(([key, value]) => {
    const entries
      = key === 'transport' && value && typeof value === 'object'
        ? Object.entries(value).map(
            ([field, setting]) => [`transport.${field}`, setting] as const,
          )
        : [[key, value] as const]
    return entries.map(([field, setting]) => {
      let label = `${group}.${field}.label`
      if (
        change.group === 'code'
        && ['semi', 'singleQuote', 'trailingComma'].includes(field)
      ) {
        label = `editor.prettier.${field}.label`
      }
      if (change.group === 'http') {
        if (field.startsWith('transport.'))
          label = `http.${field}`
        else if (field === 'historyLimit')
          label = 'http.history.label'
        else if (field === 'skipCertificateVerification')
          label = 'http.transport.skipCertificateVerification'
      }
      if (field === 'dockBadgeSource')
        label = 'appearance.dockBadge.label'
      if (field === 'autoCleanupCompleted')
        label = 'tasks.autoCleanup.label'
      if (field === 'locale')
        label = 'language.label'
      return {
        label: i18n.t(
          change.group === 'dashboard'
            ? `notes.dashboard.widgets.${field}`
            : `preferences:${label}`,
        ),
        value:
          typeof setting === 'boolean'
            ? i18n.t(`preferences:http.transport.${setting ? 'on' : 'off'}`)
            : String(setting),
      }
    })
  })
  const sensitive
    = change.group === 'tasks'
      || (change.group === 'http'
        && (change.values.skipCertificateVerification
          || change.values.transport?.skipCertificateVerification
          || change.values.transport?.followAuthorizationHeader))
  return {
    label: i18n.t(
      change.group === 'dashboard'
        ? 'notes.dashboard.title'
        : `preferences:${group}.label`,
    ),
    rows,
    sensitive,
  }
}
