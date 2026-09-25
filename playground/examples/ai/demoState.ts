import type { Ref } from 'vue'
import type { ChatMessage } from '../../../src/renderer/composables/ai/useAi'
import type { CapturedContext, DemoConversation } from './types'
import { computed, ref } from 'vue'

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export const conversation: Ref<DemoConversation> = ref({
  messages: [],
  draft: '',
})
export const isStreaming = ref(false)
export const failActions = ref(false)
export const stale = ref(false)
export const composer = ref<CapturedContext>({ mode: 'none', attachments: [] })
export const attachments = computed({
  get: () => composer.value.attachments,
  set: (value) => {
    composer.value.attachments = value
  },
})
export const contextMode = computed({
  get: () => composer.value.mode,
  set: (value) => {
    composer.value.mode = value
  },
})
export const attachedEditor = computed({
  get: () => composer.value.editor,
  set: (value) => {
    composer.value.editor = value
  },
})
export const workspaceContext = computed({
  get: () => composer.value.workspace,
  set: (value) => {
    composer.value.workspace = value
  },
})
let timer: ReturnType<typeof setTimeout> | undefined
let revision = 0
export function resetComposer(value?: CapturedContext) {
  composer.value = clone(value ?? { mode: 'none', attachments: [] })
}
export function stopTimer() {
  revision++
  clearTimeout(timer)
}
export function cancel() {
  stopTimer()
  const message = conversation.value.messages.at(-1)
  if (isStreaming.value && message?.role === 'assistant') {
    message.status = 'cancelled'
    if (message.clarification && !message.clarification.answer)
      message.clarification.cancelled = true
  }
  isStreaming.value = false
}
export function canRetry(message: ChatMessage) {
  return (
    !isStreaming.value
    && conversation.value.messages.at(-1) === message
    && conversation.value.messages.at(-2)?.role === 'user'
    && ['error', 'cancelled'].includes(message.status ?? '')
    && !message.applied
    && !message.rejected
    && !message.userContinuations?.length
    && !message.taskMutations?.length
    && !message.dataActions?.length
    && !message.workspaceCreations?.length
    && !message.httpActions?.some(action => action.state !== 'pending')
  )
}
export function stream(message: ChatMessage, text: string) {
  stopTimer()
  const current = revision
  isStreaming.value = true
  message.status = 'streaming'
  message.taskState = 'working'
  const chunks = text.match(/[\s\S]{1,12}/g) ?? []
  function tick() {
    if (current !== revision)
      return
    message.content += chunks.shift() ?? ''
    if (chunks.length) {
      timer = setTimeout(tick, 100)
    }
    else {
      message.status = 'done'
      isStreaming.value = false
      if (conversation.value.queue?.length)
        void runQueued()
    }
  }
  timer = setTimeout(tick, 300)
}
export async function send(prompt: string, captured = clone(composer.value)) {
  if (failActions.value || isStreaming.value || !prompt.trim())
    return false
  conversation.value.error = undefined
  conversation.value.diagnostic = undefined
  conversation.value.messages.push({
    role: 'user',
    content: prompt.trim(),
    attachments: clone(captured.attachments),
    contextMode: captured.mode,
    workspaceContext: clone(captured.workspace ?? null) ?? undefined,
    context:
      captured.mode === 'selection'
        ? captured.editor?.selection
        : captured.mode === 'fragment'
          ? captured.editor?.text
          : '',
    editorSnapshot:
      captured.mode === 'none'
        ? undefined
        : captured.editor && clone(captured.editor),
  })
  conversation.value.messages.push({
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'streaming',
    taskState: 'working',
    attachments: clone(captured.attachments),
  })
  conversation.value.draft = ''
  stream(
    conversation.value.messages.at(-1)!,
    'Проверяю переданный контекст.\n\n```typescript\nconst result = { ok: true }\n```\n\nДемо-ответ готов. Все действия выполнены только на тестовых данных.',
  )
  return true
}
export function enqueue(prompt: string) {
  if (!prompt.trim() || (conversation.value.queue?.length ?? 0) >= 8) {
    return false
  }
  conversation.value.queue ??= []
  conversation.value.queue.push({
    id: crypto.randomUUID(),
    prompt: prompt.trim(),
    context: clone(composer.value),
  })
  conversation.value.draft = ''
  return true
}
export async function runQueued() {
  const task = conversation.value.queue?.[0]
  if (!task || isStreaming.value)
    return
  if (await send(task.prompt, task.context)) {
    conversation.value.queue = conversation.value.queue?.filter(
      value => value.id !== task.id,
    )
  }
}
export async function retry(message: ChatMessage) {
  if (!canRetry(message))
    return false
  const user = conversation.value.messages.at(-2)!
  if (failActions.value)
    return false
  conversation.value.messages.splice(-2)
  return send(user.content, {
    mode: user.contextMode ?? 'none',
    editor: user.editorSnapshot,
    attachments: user.attachments ?? [],
    workspace: user.workspaceContext,
  })
}
export async function steer(text: string) {
  const message = conversation.value.messages.at(-1)
  if (!isStreaming.value || failActions.value || !text.trim() || !message) {
    return false
  }
  message.steering ??= []
  message.steering.push(text.trim());
  (message.userContinuations ??= []).push(text.trim())
  conversation.value.draft = ''
  return true
}
export async function answerQuestion(message: ChatMessage, answer: string) {
  if (
    !isStreaming.value
    || failActions.value
    || !answer.trim()
    || !message.clarification
  ) {
    return false
  }
  message.clarification.answer = answer.trim();
  (message.userContinuations ??= []).push(answer.trim())
  stream(
    message,
    '\n\nУчёл уточнение. Продолжаю работу с выбранным вариантом.',
  )
  return true
}
export function settleAction(message: ChatMessage) {
  if (!isStreaming.value || !conversation.value.messages.includes(message))
    return
  if (
    message.httpActions?.some(action =>
      ['pending', 'running'].includes(action.state),
    )
    || message.nativeActions?.some(action =>
      ['pending', 'running'].includes(action.status),
    )
  ) {
    return
  }
  stream(message, '\n\nДействие обработано. Демо-задача завершена.')
}
export function clearConversation() {
  cancel()
  conversation.value = { messages: [], draft: '' }
  resetComposer()
}
