import type { TaskMutation } from './taskUndo'
import type { RenderedArtifactExportResult } from '~/main/types/ipc'
import type { AiNativeAction, AiNativeResult } from '~/shared/aiNativeActions'

export type NativeBridgeAction = Extract<
  AiNativeAction,
  {
    action:
      | 'notesReveal'
      | 'codePreview'
      | 'findInContent'
      | 'format'
      | 'exportView'
      | 'httpPanel'
      | 'editorCommand'
      | 'notesSection'
      | 'presentation'
      | 'codeImageConfigure'
      | 'jsonVisualizer'
      | 'mindmap'
      | 'notesGraph'
      | 'httpView'
      | 'httpDevtools'
  }
>
export type NativeBridgeResult = Omit<AiNativeResult, 'id'> & {
  mutation?: Extract<
    TaskMutation,
    {
      kind:
        | 'tasksCleanup'
        | 'editor'
        | 'preferences'
        | 'folderIcon'
        | 'httpDraft'
    }
  >
}
type NativeBridge = (
  action: NativeBridgeAction,
  current: () => boolean,
) => Promise<NativeBridgeResult>
const bridges = new Map<string, NativeBridge>()

/** Mounted native views own their commands and reject stale targets themselves. */
export function registerNativeBridge(
  key:
    | 'codeEditor'
    | 'notesEditor'
    | 'codeImage'
    | 'jsonVisualizer'
    | 'codePreview'
    | 'mindmap'
    | 'httpRequest'
    | 'httpBottom'
    | 'httpResponse'
    | 'presentation'
    | 'notesGraph'
    | 'httpConsole',
  handler: NativeBridge,
) {
  bridges.set(key, handler)
  return () => {
    if (bridges.get(key) === handler)
      bridges.delete(key)
  }
}
export async function runNativeBridge(
  action: NativeBridgeAction,
  current: () => boolean,
) {
  const key
    = action.action === 'codePreview'
      ? 'codePreview'
      : action.action === 'httpDevtools'
        ? 'httpConsole'
        : action.action === 'notesGraph'
          ? 'notesGraph'
          : action.action === 'codeImageConfigure'
            ? 'codeImage'
            : action.action === 'jsonVisualizer' || action.action === 'mindmap'
              ? action.action
              : action.action === 'presentation'
                ? 'presentation'
                : action.action === 'httpPanel' || action.action === 'httpView'
                  ? [
                      'preview',
                      'response',
                      'responseBody',
                      'responseHeaders',
                      'responseTests',
                      'history',
                    ].includes(action.panel)
                      ? 'httpBottom'
                      : 'httpRequest'
                  : action.action === 'exportView'
                    ? action.view
                    : action.target.space === 'code'
                      ? 'codeEditor'
                      : 'notesEditor'
  const bridge = bridges.get(key)
  if (!bridge)
    return { status: 'unavailable' as const }
  return bridge(action, current)
}

export function useNativeExportBridge(
  view: 'codeImage' | 'jsonVisualizer' | 'codePreview' | 'mindmap',
  save: (
    format: 'png' | 'svg' | 'html',
    current: () => boolean,
  ) => Promise<RenderedArtifactExportResult | undefined>,
  control?: NativeBridge,
) {
  let unregister: (() => void) | undefined
  onMounted(() => {
    unregister = registerNativeBridge(view, async (action, current) => {
      if (action.action !== 'exportView')
        return control?.(action, current) ?? { status: 'unavailable' }
      if (
        action.view !== view
        || (view === 'codePreview') !== (action.format === 'html')
      ) {
        return { status: 'unavailable' }
      }
      if (!current())
        return { status: 'stale' }
      const result = await save(action.format, current)
      if (!result)
        return { status: 'unavailable' }
      return result.status === 'saved'
        ? {
            status: 'done',
            persisted: true,
            filePath: result.filePath,
            bytes: result.bytes,
            target: action.target,
          }
        : result
    })
  })
  onBeforeUnmount(() => unregister?.())
}

export async function runHttpResponseBridge(
  action: Extract<AiNativeAction, { action: 'httpPanel' | 'httpView' }>,
  current: () => boolean,
) {
  return (
    bridges.get('httpResponse')?.(action, current) ?? {
      status: 'unavailable' as const,
    }
  )
}
export function useNativeHttpPanelBridge(
  key: 'httpRequest' | 'httpBottom' | 'httpResponse',
  handler: (
    action: Extract<AiNativeAction, { action: 'httpPanel' | 'httpView' }>,
    current: () => boolean,
  ) => Promise<NativeBridgeResult>,
) {
  let unregister: (() => void) | undefined
  onMounted(() => {
    unregister = registerNativeBridge(key, async (action, current) =>
      action.action === 'httpPanel' || action.action === 'httpView'
        ? handler(action, current)
        : { status: 'unavailable' })
  })
  onBeforeUnmount(() => unregister?.())
}
