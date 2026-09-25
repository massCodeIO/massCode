import type { AiNativeAction } from '~/shared/aiNativeActions'
import { i18n } from '@/electron'

export function actionTitle(
  domain: 'native' | 'httpActions',
  action: string,
  state: string,
) {
  if (domain === 'httpActions' && action === 'send')
    return i18n.t(`ai.sendTitle.${state}`)
  const label = i18n.t(`ai.${domain}.titles.${action}`)
  if (state === 'pending')
    return label.charAt(0).toUpperCase() + label.slice(1)
  return i18n.t(`ai.actionTitle.${state}`, { action: label })
}

export function nativeActionTitle(operation: AiNativeAction, state: string) {
  if (operation.action === 'navigate')
    return i18n.t(`ai.recordTitle.${state}`)
  if (operation.action === 'setView' && operation.view === 'codePreview')
    return i18n.t(`ai.previewTitle.${state}`)
  return actionTitle('native', operation.action, state)
}
