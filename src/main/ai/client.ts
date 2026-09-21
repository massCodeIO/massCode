import type {
  AiMessage,
  AiProtocolCall,
  AiProvider,
  AiToolCall,
} from '../../shared/ai'
import type { AiResponseReplay } from '../../shared/aiResponses'
import type { AiTrace } from './trace'
import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { AI_LIMITS, aiProtocolCallSchema } from '../../shared/ai'
import { resolveAiEdits } from '../../shared/aiEdits'
import { budgetAiHistory } from '../../shared/aiHistory'
import { AiError } from './errors'
import { AI_INSTRUCTIONS } from './instructions'
import { readResponsesStream, responsesInput } from './responses'
import { editTool, validateToolCalls } from './tools'

export interface AiConnection {
  baseURL: string
  model: string
  apiKey?: string
  provider?: AiProvider
  trace?: AiTrace
}
const modelsSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1).max(256) })).max(10000),
})
const chunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z
        .object({
          tool_calls: z
            .array(
              z.object({
                index: z.number().int().min(0).max(7),
                id: z.string().optional(),
                type: z.literal('function').optional(),
                function: z
                  .object({
                    name: z.string().optional(),
                    arguments: z.string().optional(),
                  })
                  .optional(),
              }),
            )
            .max(8)
            .optional(),
          content: z.string().nullable().optional(),
          refusal: z.string().nullable().optional(),
        })
        .optional(),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
})

function headers(connection: AiConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(connection.apiKey
      ? { Authorization: `Bearer ${connection.apiKey}` }
      : {}),
  }
}
export async function checkResponse(response: Response) {
  if (response.ok)
    return
  const code
    = response.status === 401 || response.status === 403
      ? 'authentication'
      : response.status === 429
        ? 'rateLimit'
        : response.status === 404
          ? 'modelUnavailable'
          : 'upstream'
  // Keep diagnostics bounded and redact credentials; never include request headers.
  let providerCode = ''
  const reader = response.body?.getReader()
  if (reader) {
    try {
      let body = ''
      const decoder = new TextDecoder()
      while (body.length <= 16384) {
        const { value, done } = await reader.read()
        if (done)
          break
        body += decoder.decode(value, { stream: true })
      }
      if (body.length <= 16384) {
        const text = body + decoder.decode()
        let payload
        try {
          payload = JSON.parse(text)
        }
        catch {
          payload = { message: text }
        }
        const providerError = payload.error ?? payload
        const detail
          = typeof providerError === 'string'
            ? providerError
            : (providerError?.message ?? providerError?.detail)
        const value = providerError?.code
        if (
          [
            'unsupported_parameter',
            'unsupported_value',
            'model_not_found',
            'insufficient_quota',
            'rate_limit_exceeded',
            'invalid_api_key',
            'permission_denied',
            'invalid_request_error',
          ].includes(value)
        ) {
          providerCode = ` · ${value}`
        }
        if (response.status === 400 && typeof detail === 'string') {
          const message = detail
            .replace(/sk-[\w-]+/g, '[redacted]')
            .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
            .replace(/\s+/g, ' ')
            .slice(0, 500)
          providerCode += ` · ${message}`
        }
      }
    }
    catch {
      /* Error bodies are optional. */
    }
    finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  throw new AiError(code, `HTTP ${response.status}${providerCode}`)
}

// Only an explicit unsupported-tools response permits a no-tools retry.
// Arbitrary 400s, authentication failures and invalid model output do not.
async function rejectsTools(response: Response) {
  if (![400, 422].includes(response.status) || !response.body)
    return false
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      bytes += value.byteLength
      if (bytes > 16384)
        return false
      body += decoder.decode(value, { stream: true })
    }
    const error = JSON.parse(body + decoder.decode()).error
    return (
      error?.code === 'unsupported_tools'
      || (error?.code === 'unsupported_parameter'
        && ['tools', 'tool_choice'].includes(error?.param))
    )
  }
  catch {
    return false
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function listAiModels(
  connection: AiConnection,
  signal: AbortSignal,
): Promise<string[]> {
  const response = await fetch(`${connection.baseURL}/models`, {
    headers: headers(connection),
    redirect: 'error',
    signal,
  })
  await checkResponse(response)
  if (!response.body)
    throw new AiError('invalidResponse')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break
      bytes += value.byteLength
      if (bytes > AI_LIMITS.outputBytes)
        throw new AiError('outputLimit')
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    const parsed = modelsSchema.safeParse(JSON.parse(body))
    if (!parsed.success)
      throw new AiError('invalidResponse')
    return [...new Set(parsed.data.data.map(model => model.id))].sort()
  }
  catch (error) {
    if (error instanceof SyntaxError)
      throw new AiError('invalidResponse')
    throw error
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function readAiStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<AiProtocolCall[]> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let data: string[] = []
  let eventBytes = 0
  let outputBytes = 0
  let completed = false
  let finished = false
  let hasText = false
  let finishReason: string | undefined
  const calls = new Map<number, AiProtocolCall>()

  function dispatch() {
    const value = data.join('\n')
    data = []
    eventBytes = 0
    if (!value)
      return
    if (value === '[DONE]') {
      completed = true
      return
    }
    let chunk: z.infer<typeof chunkSchema>
    try {
      chunk = chunkSchema.parse(JSON.parse(value))
    }
    catch {
      throw new AiError('invalidResponse')
    }
    const choice = chunk.choices[0]
    if (
      finished
      && (choice?.delta?.content || choice?.delta?.tool_calls?.length)
    ) {
      throw new AiError('invalidResponse')
    }
    for (const delta of choice?.delta?.tool_calls ?? []) {
      outputBytes += Buffer.byteLength(JSON.stringify(delta))
      if (outputBytes > AI_LIMITS.outputBytes)
        throw new AiError('outputLimit')
      const call = calls.get(delta.index) ?? {
        id: '',
        type: 'function' as const,
        function: { name: '', arguments: '' },
      }
      call.id += delta.id ?? ''
      call.function.name = call.function.name + (delta.function?.name ?? '')
      call.function.arguments += delta.function?.arguments ?? ''
      calls.set(delta.index, call)
    }
    const text = choice?.delta?.content || choice?.delta?.refusal
    if (text) {
      outputBytes += Buffer.byteLength(text)
      if (outputBytes > AI_LIMITS.outputBytes)
        throw new AiError('outputLimit')
      hasText ||= Boolean(text.trim())
      onDelta(text)
    }
    if (choice?.finish_reason) {
      finished = true
      finishReason = choice.finish_reason
    }
  }

  function consume(eof = false) {
    while (!completed) {
      const match = /\r\n|\n|\r/.exec(pending)
      if (
        !match
        || (!eof && match[0] === '\r' && match.index === pending.length - 1)
      ) {
        break
      }
      const line = pending.slice(0, match.index)
      pending = pending.slice(match.index + match[0].length)
      eventBytes += Buffer.byteLength(line)
      if (eventBytes > AI_LIMITS.eventBytes)
        throw new AiError('outputLimit')
      if (!line)
        dispatch()
      else if (line.startsWith('data:'))
        data.push(line.slice(5).replace(/^ /, ''))
    }
    if (Buffer.byteLength(pending) + eventBytes > AI_LIMITS.eventBytes)
      throw new AiError('outputLimit')
  }
  try {
    while (!completed) {
      const { value, done } = await reader.read()
      if (done) {
        pending += decoder.decode()
        consume(true)
        if (pending) {
          pending += '\n'
          consume(true)
        }
        dispatch()
        if (!completed && !finished)
          throw new AiError('invalidResponse')
        break
      }
      pending += decoder.decode(value, { stream: true })
      consume()
    }
    if (
      calls.size
      && (!finished || !['tool_calls', 'stop'].includes(finishReason!))
    ) {
      throw new AiError('invalidResponse')
    }
    if (!hasText && !calls.size)
      throw new AiError('invalidResponse')
    return [...calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call)
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function streamAiChat(
  connection: AiConnection,
  messages: AiMessage[],
  signal: AbortSignal,
  onDelta: (text: string) => void,
  editContextId?: string,
  editContextText?: string,
  repairRemaining = 1,
  currentTurn = messages.findLastIndex(message => message.role === 'user'),
  onHistoryOmitted?: () => void,
  onResponse?: (
    messages: AiMessage[],
    answer: string,
    replay?: AiResponseReplay,
  ) => void,
  vault?: {
    tools: {
      type: string
      function: { name: string, [key: string]: unknown }
    }[]
    execute: (name: string, args: string) => Promise<unknown>
    remaining: number
    onToolRound?: () => void
    requiredTool?: () => string | undefined
  },
): Promise<AiToolCall[]> {
  if (!connection.model)
    throw new AiError('notConfigured')
  const budget = budgetAiHistory(messages, currentTurn)
  if (!budget.fits)
    throw new AiError('inputLimit')
  if (budget.omitted)
    onHistoryOmitted?.()
  currentTurn -= messages.length - budget.messages.length
  messages = budget.messages
  const requiredTool = vault?.requiredTool?.()
  if (requiredTool && !vault?.remaining)
    throw new AiError('proposalUnavailable')
  const result = await generateAiResponse(connection, {
    instructions: AI_INSTRUCTIONS,
    messages,
    tools: [
      ...(editContextId && !requiredTool ? [editTool(editContextId)] : []),
      ...(vault?.remaining
        ? vault.tools.filter(
            tool => !requiredTool || tool.function.name === requiredTool,
          )
        : []),
    ],
    toolChoice: requiredTool ? 'required' : 'auto',
    signal,
    onDelta,
    operation: 'chat',
  })
  const { calls, answer, replay } = result
  const assistant: AiMessage = {
    role: 'assistant',
    content: answer,
    ...(calls.length ? { tool_calls: calls } : {}),
    ...(replay ? { openaiResponse: replay } : {}),
  }
  if (!calls.length) {
    if (requiredTool)
      throw new AiError('proposalUnavailable')
    onResponse?.(messages, answer, replay)
    return []
  }
  if (
    vault?.remaining
    && calls.some(call => call.function.name !== 'propose_edit')
  ) {
    signal.throwIfAborted()
    if (
      !calls.every(call => aiProtocolCallSchema.safeParse(call).success)
      || new Set(calls.map(call => call.id)).size !== calls.length
    ) {
      throw new AiError('invalidResponse')
    }
    vault.onToolRound?.()
    const results: AiMessage[] = []
    for (const call of calls) {
      signal.throwIfAborted()
      connection.trace?.event(
        'tool.start',
        { name: call.function.name },
        { arguments: call.function.arguments },
      )
      const result
        = call.function.name === 'propose_edit'
          ? {
              error: 'READ_FIRST',
              instruction:
                'Finish reading context, then propose edits in a separate turn.',
            }
          : await vault.execute(call.function.name, call.function.arguments)
      connection.trace?.event(
        'tool.complete',
        { name: call.function.name },
        result,
      )
      results.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      })
    }
    return streamAiChat(
      connection,
      [...messages, assistant, ...results],
      signal,
      onDelta,
      vault.remaining > 1 ? editContextId : undefined,
      vault.remaining > 1 ? editContextText : undefined,
      repairRemaining,
      currentTurn,
      onHistoryOmitted,
      onResponse,
      { ...vault, remaining: vault.remaining - 1 },
    )
  }
  let validated: AiToolCall[] = []
  let reason = 'invalid_arguments'
  try {
    validated = validateToolCalls(calls, editContextId)
    if (editContextId && editContextText !== undefined) {
      const result = resolveAiEdits(editContextId, editContextText, validated)
      if (!result.ok) {
        reason = result.reason
        validated = []
      }
    }
  }
  catch {
    // Schema/JSON failures are tool failures, not failed conversations.
  }
  if (validated.length) {
    onResponse?.(messages, answer, replay)
    return validated
  }
  // A server ignoring the no-tools request must not create an unbounded loop.
  if (!editContextId) {
    if (!answer.trim())
      throw new AiError('invalidResponse')
    return []
  }
  signal.throwIfAborted()
  const correlated
    = calls.every(call => aiProtocolCallSchema.safeParse(call).success)
      && new Set(calls.map(call => call.id)).size === calls.length
  const retryMessages: AiMessage[] = correlated
    ? [
        ...messages,
        assistant,
        ...calls.map(call => ({
          role: 'tool' as const,
          tool_call_id: call.id,
          content: JSON.stringify({
            status: 'validation_failed',
            reason,
            applied: false,
            context_id: editContextId,
            original_code: editContextText,
            instruction: repairRemaining
              ? 'Reconsider the original user request. If no snippet change is needed, answer normally without tools. Otherwise correct the proposal: old_text must match exactly once in the original context, and edits must not overlap. Nothing was applied.'
              : 'No proposal was accepted. Answer the original request normally without tools. You may show examples. If changes were requested, explain that no applicable proposal was created. Nothing was applied.',
          }),
        })),
      ]
    : messages
  if (answer)
    onDelta('\n\n')
  return streamAiChat(
    connection,
    retryMessages,
    signal,
    onDelta,
    repairRemaining && correlated ? editContextId : undefined,
    repairRemaining && correlated ? editContextText : undefined,
    0,
    currentTurn,
    onHistoryOmitted,
    onResponse,
    vault,
  )
}

export async function generateAiResponse(
  connection: AiConnection,
  options: {
    instructions: string
    messages: AiMessage[]
    tools?: {
      type: string
      function: { name: string, [key: string]: unknown }
    }[]
    toolChoice?: 'auto' | 'required'
    signal: AbortSignal
    onDelta: (text: string) => void
    operation: string
  },
) {
  const openai = connection.provider === 'openai'
  const endpoint = openai ? '/responses' : '/chat/completions'
  const tools = options.tools ?? []
  const input = openai
    ? responsesInput(options.messages, connection.model)
    : options.messages.map(
        ({ openaiResponse: _replay, ...message }) => message,
      )
  const body = openai
    ? {
        model: connection.model,
        stream: true,
        store: false,
        instructions: options.instructions,
        input,
        ...(tools.length
          ? {
              tools: tools.map(tool => ({
                ...tool.function,
                type: 'function',
                strict: false,
              })),
              tool_choice: options.toolChoice ?? 'auto',
            }
          : {}),
      }
    : {
        model: connection.model,
        stream: true,
        messages: [{ role: 'system', content: options.instructions }, ...input],
        ...(tools.length
          ? { tools, tool_choice: options.toolChoice ?? 'auto' }
          : {}),
      }
  const span = connection.trace?.nextSpan()
  const started = Date.now()
  connection.trace?.event(
    'request.start',
    {
      span,
      operation: options.operation,
      endpoint,
      inputBytes: Buffer.byteLength(JSON.stringify(body)),
      tools: tools.map(tool => tool.function.name),
    },
    body,
  )
  let answer = ''
  try {
    const response = await fetch(`${connection.baseURL}${endpoint}`, {
      method: 'POST',
      headers: headers(connection),
      redirect: 'error',
      signal: options.signal,
      body: JSON.stringify(body),
    })
    connection.trace?.event('request.headers', {
      span,
      status: response.status,
      requestId: response.headers.get('x-request-id'),
    })
    if (
      !openai
      && tools.length
      && [400, 422].includes(response.status)
      && (await rejectsTools(response.clone()))
    ) {
      void response.body?.cancel()
      if (options.toolChoice === 'required')
        throw new AiError('proposalUnavailable')
      connection.trace?.event('request.retry', {
        span,
        reason: 'unsupported_tools',
      })
      return generateAiResponse(connection, { ...options, tools: [] })
    }
    await checkResponse(response)
    if (!response.body)
      throw new AiError('invalidResponse')
    const onDelta = (text: string) => {
      answer += text
      options.onDelta(text)
    }
    const result = openai
      ? await readResponsesStream(response.body, connection.model, onDelta)
      : {
          calls: await readAiStream(response.body, onDelta),
          replay: undefined,
          usage: undefined,
        }
    connection.trace?.event(
      'request.complete',
      {
        span,
        durationMs: Date.now() - started,
        outputBytes: Buffer.byteLength(answer),
        toolCalls: result.calls.map(call => call.function.name),
        usage: result.usage,
      },
      { answer, calls: result.calls },
    )
    return { ...result, answer }
  }
  catch (error) {
    connection.trace?.event(
      options.signal.aborted ? 'request.cancelled' : 'request.error',
      {
        span,
        durationMs: Date.now() - started,
        code: error instanceof AiError ? error.code : 'connection',
      },
    )
    throw error
  }
}
