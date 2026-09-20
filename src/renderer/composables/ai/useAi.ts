import type { EditSnapshot } from './edit'
import type {
  AiErrorCode,
  AiEvent,
  AiMessage,
  AiResult,
  AiSettings,
  AiToolCall,
} from '~/shared/ai'
import { ipc, store } from '@/electron'
import { aiProposalSchema } from '~/shared/ai'
import { budgetAiHistory } from '~/shared/aiHistory'
import { buildReplacement, matchesSnapshot } from './edit'

export interface AiContext {
  snippetId: number
  contentId: number
  text: string
  selection: string
  selectionFrom?: number
  selectionTo?: number
  language: string
}
export interface ChatMessage extends AiMessage {
  role: 'user' | 'assistant'
  rejected?: boolean
  calls?: AiToolCall[]
  toolContent?: string
  replacement?: string
  proposalSummary?: string
  editRequested?: boolean
  edit?: EditSnapshot
  applied?: boolean
  wireContent?: string
  contextMode?: 'selection' | 'fragment'
  context?: string
  status?: 'streaming' | 'done' | 'cancelled' | 'error'
}
interface Conversation {
  messages: ChatMessage[]
  draft: string
  historyOmitted?: boolean
  error?: AiErrorCode
}
const open = ref(store.app.get('code.layout.inspectorOpen') === true)
const settings = ref<AiSettings>()
const context = ref<AiContext>()
const contextMode = ref<'selection' | 'fragment'>('selection')
const conversations = reactive<Record<string, Conversation>>({})
const currentKey = ref('')
const active = ref<{ requestId: string, key: string }>()
let vault = ''
let snapshotReader: (() => AiContext | undefined) | undefined
let editorWriter:
  | ((snapshot: EditSnapshot, replacement: string) => boolean)
  | undefined
let listening = false

function syncVault() {
  const next = store.preferences.get<string>('storage.vaultPath') ?? ''
  if (next === vault)
    return
  cancel()
  for (const key of Object.keys(conversations)) delete conversations[key]
  vault = next
  currentKey.value = ''
  context.value = undefined
}

function onEvent(_event: unknown, event: AiEvent) {
  if (event.requestId !== active.value?.requestId)
    return
  const conversation = conversations[active.value.key]
  const message = conversation?.messages.at(-1)
  if (!message || message.role !== 'assistant')
    return
  if (event.type === 'historyOmitted') {
    conversation.historyOmitted = true
    return
  }
  if (event.type === 'notice') {
    conversation.error = event.error
    return
  }
  if (event.type === 'tools') {
    message.toolContent = message.content
    message.content = ''
    message.calls = event.calls
    if (message.edit) {
      message.replacement = buildReplacement(message.edit, event.calls)
      message.proposalSummary = event.calls
        .map(
          call =>
            aiProposalSchema.parse(JSON.parse(call.function.arguments)).summary,
        )
        .join('\n')
    }
    return
  }
  if (event.type === 'delta') {
    message.content += event.text
    return
  }
  message.status = event.type === 'error' ? 'error' : event.type
  if (event.type === 'error')
    conversation.error = event.error
  active.value = undefined
}

function cancel() {
  const request = active.value
  if (!request)
    return
  const message = conversations[request.key]?.messages.at(-1)
  if (message?.role === 'assistant')
    message.status = 'cancelled'
  active.value = undefined
  void ipc
    .invoke('system:ai:cancel', { requestId: request.requestId })
    .catch(() => {})
}

function setContext(value?: AiContext) {
  syncVault()
  const key = value ? `${value.snippetId}:${value.contentId}` : ''
  if (key !== currentKey.value) {
    cancel()
    currentKey.value = key
    contextMode.value = value?.selection ? 'selection' : 'fragment'
  }
  context.value = value
  if (key && !conversations[key])
    conversations[key] = { messages: [], draft: '' }
}

async function refreshSettings() {
  const result = (await ipc.invoke(
    'system:ai:settings',
    null,
  )) as AiResult<AiSettings>
  if (result.ok)
    settings.value = result.data
  return result
}

function setOpen(value: boolean) {
  open.value = value
  store.app.set('code.layout.inspectorOpen', value)
  if (value) {
    const latest = snapshotReader?.()
    setContext(latest)
    contextMode.value = latest?.selection ? 'selection' : 'fragment'
    void refreshSettings().catch(() => {})
  }
}

function registerEditor(
  reader: () => AiContext | undefined,
  writer?: typeof editorWriter,
) {
  editorWriter = writer
  snapshotReader = reader
  setContext(reader())
  return () => {
    if (snapshotReader === reader) {
      editorWriter = undefined
      snapshotReader = undefined
      setContext(undefined)
    }
  }
}

async function send(
  prompt: string,
  proposeEdit = false,
  retryMessage?: ChatMessage,
) {
  const previousKey = currentKey.value
  const previousVault = vault
  const latest = snapshotReader?.()
  setContext(latest)
  if (
    retryMessage
    && (previousKey !== currentKey.value
      || previousVault !== vault
      || !canRetry(retryMessage))
  ) {
    return false
  }
  if (!latest || active.value || !prompt.trim())
    return false
  const conversation = conversations[currentKey.value]
  const mode = retryMessage
    ? (conversation.messages.at(-2)?.contextMode ?? contextMode.value)
    : contextMode.value
  const text = mode === 'selection' ? latest.selection : latest.text
  if (!text.trim())
    return false
  const from = mode === 'selection' ? latest.selectionFrom : 0
  const to = mode === 'selection' ? latest.selectionTo : latest.text.length
  const hasRange
    = from !== undefined
      && to !== undefined
      && latest.text.slice(from, to) === text
  if (proposeEdit && !hasRange)
    return false
  const requestId = crypto.randomUUID()
  const edit: EditSnapshot | undefined = hasRange
    ? {
        contextId: requestId,
        snippetId: latest.snippetId,
        contentId: latest.contentId,
        text: latest.text,
        from: from!,
        to: to!,
        vault,
      }
    : undefined
  conversation.error = undefined
  // Each turn records exactly the visible context snapshot, including unsaved edits.
  const instruction = proposeEdit
    ? '\nUse propose_edit to propose the requested change for review.'
    : ''
  const wireContent = `${prompt.trim()}${instruction}\n\n<code-context id=${JSON.stringify(requestId)} language=${JSON.stringify(latest.language)}>\n${text}\n</code-context>`
  const history: AiMessage[] = (
    retryMessage ? conversation.messages.slice(0, -2) : conversation.messages
  )
    .filter(
      message =>
        message.role === 'user'
        || message.status === 'done'
        || message.calls?.length,
    )
    .flatMap((message): AiMessage[] => {
      if (!message.calls?.length) {
        return [
          {
            role: message.role,
            content: message.wireContent ?? message.content,
          },
        ]
      }
      const status = message.applied
        ? 'applied'
        : message.rejected
          ? 'rejected'
          : message.replacement === undefined
            ? 'invalid_edits'
            : 'awaiting_user_review'
      return [
        {
          role: 'assistant',
          content: message.toolContent ?? '',
          tool_calls: message.calls.map(call => ({
            id: call.id,
            type: call.type,
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
          })),
        },
        ...message.calls.map(call => ({
          role: 'tool' as const,
          tool_call_id: call.id,
          content: JSON.stringify({
            status,
            note: 'Only applied means the editor was modified. The latest code-context is authoritative.',
          }),
        })),
        ...(message.content
          ? [{ role: 'assistant' as const, content: message.content }]
          : []),
      ]
    })
  const messages: AiMessage[] = [
    ...history,
    { role: 'user', content: wireContent },
  ]
  const budget = budgetAiHistory(messages, history.length)
  if (!budget.fits) {
    conversation.error = 'inputLimit'
    return false
  }
  conversation.historyOmitted = budget.omitted
  if (retryMessage)
    conversation.messages.splice(-2)
  const key = currentKey.value
  conversation.messages.push({
    role: 'user',
    content: prompt.trim(),
    wireContent,
    context: text,
    contextMode: mode,
  })
  conversation.messages.push({
    role: 'assistant',
    content: '',
    status: 'streaming',
    edit,
    editRequested: proposeEdit,
  })
  if (!retryMessage)
    conversation.draft = ''
  active.value = { requestId, key }
  try {
    const result = (await ipc.invoke('system:ai:start', {
      requestId,
      editContextId: edit?.contextId,
      editContextText: edit ? text : undefined,
      messages: budget.messages,
    })) as AiResult<{ requestId: string }>
    if (!result.ok && active.value?.requestId === requestId)
      onEvent(null, { requestId, type: 'error', error: result.error })
  }
  catch {
    if (active.value?.requestId === requestId)
      onEvent(null, { requestId, type: 'error', error: 'connection' })
  }
  return true
}

function canRetry(message: ChatMessage) {
  return (
    !active.value
    && !message.applied
    && !message.rejected
    && (message.status === 'error' || message.status === 'cancelled')
    && conversations[currentKey.value]?.messages.at(-1) === message
    && conversations[currentKey.value]?.messages.at(-2)?.role === 'user'
  )
}

function retry(message: ChatMessage) {
  if (!canRetry(message))
    return Promise.resolve(false)
  return send(
    conversations[currentKey.value].messages.at(-2)!.content,
    message.editRequested,
    message,
  )
}

function canApply(message: ChatMessage) {
  return Boolean(
    message.edit
    && !message.applied
    && !message.rejected
    && message.replacement !== undefined
    && message.status !== 'streaming'
    && !active.value
    && conversations[currentKey.value]?.messages.includes(message)
    && matchesSnapshot(
      message.edit,
      snapshotReader?.(),
      store.preferences.get<string>('storage.vaultPath') ?? '',
    ),
  )
}

function applyEdit(message: ChatMessage) {
  if (!canApply(message) || !message.edit)
    return false
  const replacement = message.calls
    ? buildReplacement(message.edit, message.calls)
    : undefined
  if (replacement === undefined || !editorWriter?.(message.edit, replacement))
    return false
  message.applied = true
  return true
}

function rejectEdit(message: ChatMessage) {
  if (
    conversations[currentKey.value]?.messages.includes(message)
    && !message.applied
  ) {
    message.rejected = true
  }
}

function clearConversation() {
  cancel()
  if (currentKey.value)
    conversations[currentKey.value] = { messages: [], draft: '' }
}

export function useAi() {
  if (!listening) {
    ipc.on('system:ai:event', onEvent)
    listening = true
  }
  return {
    open,
    settings,
    context,
    contextMode,
    conversation: computed(() => conversations[currentKey.value]),
    isStreaming: computed(
      () => active.value?.key === currentKey.value && Boolean(active.value),
    ),
    setOpen,
    setContext,
    registerEditor,
    refreshSettings,
    send,
    cancel,
    clearConversation,
    canRetry,
    retry,
    canApply,
    applyEdit,
    rejectEdit,
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancel()
    if (listening)
      ipc.removeListeners('system:ai:event')
  })
}
