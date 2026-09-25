import { clsx } from 'clsx'
import i18next from 'i18next'
import { twMerge } from 'tailwind-merge'
import { computed, ref } from 'vue'
import { isBoundaryNativeAction } from '../../../src/shared/aiNativeActions'
import {
  answerQuestion,
  attachedEditor,
  attachments,
  cancel,
  canRetry,
  clearConversation,
  clone,
  contextMode,
  conversation,
  enqueue,
  failActions,
  isStreaming,
  retry,
  runQueued,
  send,
  settleAction,
  stale,
  steer,
  workspaceContext,
} from './demoState'
import { demoEditor, demoRecords } from './fixtures'

export {
  conversation,
  failActions,
  isStreaming,
  resetComposer,
} from './demoState'

const locales = import.meta.glob(
  '../../../src/main/i18n/locales/{en_US,ru_RU}/*.json',
  { eager: true, import: 'default' },
)
const resources: Record<string, any> = {}
for (const [path, data] of Object.entries(locales)) {
  const [, language, namespace] = path.match(
    /locales\/([^/]+)\/([^/]+)\.json$/,
  )!;
  (resources[language] ??= {})[namespace] = data
}
export const i18n = i18next.createInstance()
i18n.init({
  lng: 'en_US',
  fallbackLng: 'en_US',
  defaultNS: 'ui',
  resources,
  initImmediate: false,
  interpolation: { escapeValue: false },
})
export const cn = (...values: any[]) => twMerge(clsx(values))
export const isMac = true
export const isWindows = false
export const dark = ref(true)
export const notice = ref('')
export const requestDirty = ref(false)
export const searchMode = ref('normal')
export const unavailableWorkspaceItems = computed(
  () =>
    new Set(
      conversation.value.messages.flatMap(message =>
        (message.workspaceCreations ?? []).flatMap(creation =>
          creation.items
            .filter(item => creation.undone.includes(item.operationIndex))
            .map(item => `${item.type}:${item.id}`),
        ),
      ),
    ),
)
export const context = ref(demoEditor)
export const settings = ref({
  provider: 'openai',
  profiles: { openai: { model: 'Demo · no network', hasKey: true } },
})
function demo(text: string) {
  notice.value = text
}
async function succeed() {
  if (failActions.value)
    return false
  return true
}
async function apply(message: any) {
  if (!(await succeed()))
    return false
  message.applied = true
  message.taskMutations = [
    { kind: 'workspace', id: 'demo-mutation', index: 0 },
  ]
  return true
}
export function useAi() {
  return {
    send,
    attachments,
    contextMode,
    attachedEditor,
    workspaceContext,
    attachEditor: (mode: 'selection' | 'fragment') => {
      contextMode.value = mode
      attachedEditor.value = { ...context.value }
    },
    removeEditorContext: () => {
      contextMode.value = 'none'
      attachedEditor.value = undefined
    },
    addAttachment: (item: any) => {
      if (
        attachments.value.length < 8
        && !attachments.value.some(
          value => value.type === item.type && value.id === item.id,
        )
      ) {
        attachments.value.push({ ...item })
      }
    },
    removeAttachment: (index: number) => attachments.value.splice(index, 1),
    attachWorkspaceContext: () => {
      workspaceContext.value = { space: 'code', selectedIds: [139] }
    },
    removeWorkspaceContext: () => {
      workspaceContext.value = undefined
    },
    cancel,
    steer,
    enqueue,
    removeQueued: (id: string) => {
      conversation.value.queue = conversation.value.queue?.filter(
        task => task.id !== id,
      )
    },
    runQueued,
    conversation,
    isStreaming,
    settings,
    context,
    unavailableWorkspaceItems,
    refreshSettings: async () => {},
    setOpen: () => {},
    clearConversation: () => {
      clearConversation()
      attachments.value = [clone(demoRecords[0]!)]
    },
    canRetry,
    retry,
    answerQuestion,
    canApply: (m: any) =>
      !stale.value && !m.applied && !m.rejected && !isStreaming.value,
    canApplyHttp: (m: any) =>
      !stale.value && !m.applied && !m.rejected && !isStreaming.value,
    canPerformHttpAction: (m: any) =>
      isStreaming.value
      && m === conversation.value.messages.at(-1)
      && !!m.actionRequestId,
    applyEdit: apply,
    applyHttp: apply,
    rejectEdit: (m: any) => {
      m.rejected = true
    },
    applyNativeAction: async (_m: any, action: any) => {
      if (failActions.value)
        throw new Error('demo')
      action.status = 'running'
      _m.taskState = 'waitingNative'
      await new Promise(resolve => setTimeout(resolve, 500))
      if (
        !isStreaming.value
        || !conversation.value.messages.includes(_m)
        || action.status === 'cancelled'
        || action.state === 'cancelled'
      ) {
        return
      }
      action.status = 'done'
      action.result = { id: action.id, status: 'done' }
      if (isBoundaryNativeAction(action.operation)) {
        _m.status = 'done'
        isStreaming.value = false
      }
      else {
        settleAction(_m)
      }
    },
    cancelNativeAction: async (m: any, action: any) => {
      action.status = 'cancelled'
      settleAction(m)
    },
    applyHttpAction: async (_m: any, action: any) => {
      if (!(await succeed()))
        return false
      action.state = 'running'
      _m.taskState = 'waitingNative'
      await new Promise(resolve => setTimeout(resolve, 500))
      if (
        !isStreaming.value
        || !conversation.value.messages.includes(_m)
        || action.status === 'cancelled'
        || action.state === 'cancelled'
      ) {
        return false
      }
      action.state = 'done'
      action.result
        = action.action === 'send'
          ? { status: 200, durationMs: 143 }
          : { completed: true }
      if (action.run) {
        action.run.view.state = 'passed'
        action.run.view.steps.forEach((step: any) => {
          step.state = 'passed'
        })
      }
      settleAction(_m)
      return true
    },
    cancelHttpAction: async (action: any) => {
      action.state = 'cancelled'
      const m = conversation.value.messages.at(-1)
      if (m)
        settleAction(m)
    },
    setWorkspaceItems: (m: any, items: any[]) => {
      m.workspaceItems = items
    },
    setWorkspaceApplied: (m: any, indexes: number[]) => {
      m.workspaceApplied = indexes
      m.applied = indexes.length === m.workspaceProposal.changes.length
    },
    markWorkspaceUndone: (m: any, index: number, id?: string) => {
      const c = m.workspaceCreations?.find((c: any) => c.proposal.id === id)
      if (c)
        c.undone.push(index)
      else (m.workspaceUndone ??= []).push(index)
      for (const receipt of m.taskMutations ?? []) {
        if (
          receipt.kind === 'workspace'
          && receipt.id === (id ?? m.workspaceProposal?.id)
          && receipt.index === index
        ) {
          receipt.undone = true
        }
      }
    },
    undoTask: (m: any) => {
      if (failActions.value) {
        m.undoConflicts = ['Demo conflict']
        return
      }
      m.taskMutations?.forEach((r: any) => {
        r.undone = true
      })
      m.workspaceCreations?.forEach((c: any) => {
        c.undone = [...c.applied]
      })
      m.workspaceUndone = [...(m.workspaceApplied ?? [])]
      if (m.edit || m.httpProposal) {
        m.applied = false
        m.rejected = true
      }
      demo('Демо: изменения отменены.')
    },
  }
}
export const ipc = {
  invoke: async (channel: string, data: any) => {
    if (failActions.value)
      return { ok: false }
    if (channel === 'system:ai:context-search') {
      if (searchMode.value === 'loading')
        await new Promise(resolve => setTimeout(resolve, 2500))
      if (searchMode.value === 'error')
        return { ok: false }
      return {
        ok: true,
        data:
          searchMode.value === 'empty'
            ? []
            : demoRecords.filter(item =>
                item.name
                  .toLowerCase()
                  .includes((data.query ?? '').toLowerCase()),
              ),
      }
    }
    if (channel === 'system:ai:workspace-apply') {
      const message = conversation.value.messages.find(
        m => m.workspaceProposal?.id === data.id,
      )!
      const applied = [
        ...new Set([...(message.workspaceApplied ?? []), ...data.indexes]),
      ] as number[]
      const items = applied.flatMap((index) => {
        const change = message.workspaceProposal!.changes[index]!
        return change.operation.kind === 'item'
          && change.operation.action !== 'permanentDelete'
          ? [
              {
                type:
                  change.operation.space === 'code'
                    ? 'snippet'
                    : change.operation.space === 'notes'
                      ? 'note'
                      : 'http_request',
                id: change.operation.id ?? 1000 + index,
                name: change.name,
                operationIndex: index,
              },
            ]
          : []
      })
      message.taskMutations = applied.map(index => ({
        kind: 'workspace',
        id: data.id,
        index,
      }))
      return { ok: true, data: { items, applied } }
    }
    if (channel === 'system:ai:workspace-undo')
      return { ok: true, data: true }
    demo(`Демо: ${channel}. Внешнее действие не выполнялось.`)
    return { ok: true }
  },
}
const memoryStore = {
  get: (key: string) => (key === 'localization.locale' ? 'en_US' : undefined),
  set: () => {},
}
export const store = { app: memoryStore, preferences: memoryStore }
export const router = { push: () => demo('Демо: переход в настройки.') }
export const RouterName = { preferencesAI: 'preferencesAI' }
export async function openInternalTarget(target: any) {
  return demo(`Демо: открыть ${target.type} #${target.id}`)
}
export const useHttpRuntime = () => ({ requestDirty })
export function useHttpRunner() {
  return {
    adoptRunner: async () => demo('Демо: открыть результаты запуска коллекции.'),
  }
}
export function useCopyToClipboard() {
  return async (_text: string) => {
    demo('Демо: копирование. Буфер обмена не изменён.')
    return true
  }
}
export function useTheme() {
  return {
    isDark: dark,
    editorThemeName: computed(() => (dark.value ? 'oceanic-next' : 'neo')),
  }
}
