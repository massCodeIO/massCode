import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aiHttpContextSchema,
  aiHttpProposalSchema,
} from '../../../src/shared/aiHttp'
import {
  aiNativeActionSchema,
  aiNativeResultSchema,
} from '../../../src/shared/aiNativeActions'
import { workspaceOperationSchema } from '../../../src/shared/aiWorkspace'
import {
  answerQuestion,
  cancel,
  canRetry,
  clearConversation,
  clone,
  composer,
  conversation,
  enqueue,
  failActions,
  isStreaming,
  resetComposer,
  retry,
  runQueued,
  send,
  settleAction,
  stopTimer,
} from './demoState'
import { demoEditor, demoRecords, scenarios } from './fixtures'
import { ipc, useAi } from './mocks'

beforeEach(() => {
  vi.useFakeTimers()
  clearConversation()
  failActions.value = false
})
afterEach(() => {
  stopTimer()
  vi.useRealTimers()
})

describe('fixture contracts', () => {
  for (const scenario of scenarios) {
    it(`${scenario.id} ${scenario.title}`, () => {
      for (const message of scenario.conversation.messages) {
        if (message.edit) {
          expect(message.edit.to).toBeLessThanOrEqual(message.edit.text.length)
          expect(message.edit.from).toBeGreaterThanOrEqual(0)
        }
        if (message.contextMode === 'selection') {
          const editor = message.editorSnapshot!
          expect(
            editor.text.slice(editor.selectionFrom, editor.selectionTo),
          ).toBe(message.context)
        }
        if (message.httpProposal) {
          aiHttpProposalSchema.parse(message.httpProposal)
          aiHttpContextSchema.parse(message.httpSnapshot!.context)
          expect(message.httpSnapshot!.context.contextId).toBe(
            message.httpProposal.context_id,
          )
        }
        for (const action of message.nativeActions ?? []) {
          if (action.operation)
            aiNativeActionSchema.parse(action.operation)
          if (action.result)
            aiNativeResultSchema.parse(action.result)
        }
        const changes = [
          ...(message.workspaceProposal?.changes ?? []),
          ...(message.workspaceCreations ?? []).flatMap(
            creation => creation.proposal.changes,
          ),
        ]
        for (const change of changes) {
          workspaceOperationSchema.parse(change.operation)
          if (change.operation.action === 'create') {
            expect(JSON.parse(change.before)).toEqual({})
            expect(JSON.parse(change.after)).toEqual(change.operation.fields)
          }
          else {
            expect(change.operation.id).toBeGreaterThan(0)
          }
        }
        for (const action of message.httpActions ?? []) {
          if (action.trust)
            expect(action.action).toBe('scriptTrust')
          if (['pending', 'running'].includes(action.state)) {
            expect(scenario.streaming).toBe(true)
            expect(message.status).toBe('streaming')
            expect(message.actionRequestId).toBeTruthy()
          }
        }
      }
    })
  }
})

it('preserves composer context, records a snapshot, stops and retries the same pair', async () => {
  resetComposer({
    mode: 'selection',
    editor: demoEditor,
    attachments: demoRecords.slice(0, 2),
  })
  await send('Проверь код')
  expect(isStreaming.value).toBe(true)
  expect(composer.value.attachments).toHaveLength(2)
  composer.value.attachments.pop()
  expect(conversation.value.messages[0]!.attachments).toHaveLength(2)
  cancel()
  const message = conversation.value.messages.at(-1)!
  expect(message.status).toBe('cancelled')
  expect(canRetry(message)).toBe(true)
  await retry(message)
  expect(conversation.value.messages).toHaveLength(2)
  expect(conversation.value.messages[0]!.attachments).toHaveLength(2)
  await vi.runAllTimersAsync()
  expect(conversation.value.messages.at(-1)!.status).toBe('done')
})
it('retains queued context and does not discard a failed start', async () => {
  resetComposer({ mode: 'selection', editor: demoEditor, attachments: [] })
  enqueue('Проверь выделение')
  resetComposer()
  failActions.value = true
  await runQueued()
  expect(conversation.value.queue).toHaveLength(1)
  failActions.value = false
  await runQueued()
  expect(conversation.value.queue).toHaveLength(0)
  expect(conversation.value.messages[0]!.context).toBe(demoEditor.selection)
})
it('resumes after clarification and disallows unsafe retry', async () => {
  conversation.value = clone(
    scenarios.find(s => s.title === 'Уточняющий вопрос')!.conversation,
  )
  isStreaming.value = true
  const message = conversation.value.messages.at(-1)!
  await answerQuestion(message, 'Вернуть null')
  expect(message.taskState).toBe('working')
  expect(isStreaming.value).toBe(true)
  cancel()
  expect(canRetry(message)).toBe(false)
})
it('finishes confirmation instead of leaving a waiting label', async () => {
  conversation.value = clone(
    scenarios.find(s => s.title === 'Открыть предпросмотр кода')!
      .conversation,
  )
  isStreaming.value = true
  const message = conversation.value.messages.at(-1)!
  message.nativeActions![0]!.status = 'done'
  settleAction(message)
  expect(message.taskState).toBe('working')
  await vi.runAllTimersAsync()
  expect(isStreaming.value).toBe(false)
  expect(message.status).toBe('done')
})
it('returns cumulative workspace receipts and synchronizes undo', async () => {
  conversation.value = clone(
    scenarios.find(s => s.title === 'Пакет изменений')!.conversation,
  )
  const message = conversation.value.messages.at(-1)!
  const first = await ipc.invoke('system:ai:workspace-apply', {
    id: message.workspaceProposal!.id,
    indexes: [0],
  })
  useAi().setWorkspaceApplied(message, (first as any).data.applied)
  const second = await ipc.invoke('system:ai:workspace-apply', {
    id: message.workspaceProposal!.id,
    indexes: [1],
  })
  expect((second as any).data.applied).toEqual([0, 1])
  expect((second as any).data.items).toHaveLength(2)
  useAi().setWorkspaceApplied(message, (second as any).data.applied)
  useAi().undoTask(message)
  expect(message.workspaceUndone).toEqual([0, 1])
  expect(message.taskMutations?.every(receipt => receipt.undone)).toBe(true)
})
it('new chat resets queue, errors, draft and streaming', () => {
  conversation.value.error = 'connection'
  conversation.value.draft = 'draft'
  enqueue('next')
  isStreaming.value = true
  clearConversation()
  expect(conversation.value).toEqual({ messages: [], draft: '' })
  expect(isStreaming.value).toBe(false)
})
