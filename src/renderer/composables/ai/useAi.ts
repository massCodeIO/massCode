import type {
  AiErrorCode,
  AiEvent,
  AiMessage,
  AiResult,
  AiSettings,
} from '~/shared/ai'
import { ipc, store } from '@/electron'
import { AI_LIMITS } from '~/shared/ai'

export interface AiContext {
  snippetId: number
  contentId: number
  text: string
  selection: string
  language: string
}
interface ChatMessage extends AiMessage {
  wireContent?: string
  context?: string
  status?: 'streaming' | 'done' | 'cancelled' | 'error'
}
interface Conversation {
  messages: ChatMessage[]
  draft: string
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

function registerEditor(reader: () => AiContext | undefined) {
  snapshotReader = reader
  setContext(reader())
  return () => {
    if (snapshotReader === reader) {
      snapshotReader = undefined
      setContext(undefined)
    }
  }
}

async function send(prompt: string) {
  const latest = snapshotReader?.()
  setContext(latest)
  if (!latest || active.value || !prompt.trim())
    return false
  const conversation = conversations[currentKey.value]
  const text
    = contextMode.value === 'selection' ? latest.selection : latest.text
  if (!text.trim())
    return false
  conversation.error = undefined
  // Each turn records exactly the visible context snapshot, including unsaved edits.
  const wireContent = `${prompt.trim()}\n\n<code-context language=${JSON.stringify(latest.language)}>\n${text}\n</code-context>`
  const history: AiMessage[] = conversation.messages
    .filter(message => message.role === 'user' || message.status === 'done')
    .map(message => ({
      role: message.role,
      content: message.wireContent ?? message.content,
    }))
  const messages: AiMessage[] = [
    ...history,
    { role: 'user', content: wireContent },
  ]
  if (
    messages.length > AI_LIMITS.messages
    || new TextEncoder().encode(
      messages.map(message => message.content).join(''),
    ).length > AI_LIMITS.inputBytes
  ) {
    conversation.error = 'inputLimit'
    return false
  }
  const requestId = crypto.randomUUID()
  const key = currentKey.value
  conversation.messages.push({
    role: 'user',
    content: prompt.trim(),
    wireContent,
    context: text,
  })
  conversation.messages.push({
    role: 'assistant',
    content: '',
    status: 'streaming',
  })
  conversation.draft = ''
  active.value = { requestId, key }
  try {
    const result = (await ipc.invoke('system:ai:start', {
      requestId,
      messages,
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
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancel()
    if (listening)
      ipc.removeListeners('system:ai:event')
  })
}
