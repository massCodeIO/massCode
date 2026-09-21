import type { ModelMessage, ToolSet } from 'ai'
import type { AiMessage, AiProtocolCall, AiProvider } from '../../shared/ai'
import type { AiConnection, generateAiResponse } from './client'
import { Buffer } from 'node:buffer'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createXai } from '@ai-sdk/xai'
import { APICallError, jsonSchema, streamText } from 'ai'
import { AI_LIMITS, aiProtocolCallSchema } from '../../shared/ai'
import { aiSdkReplaySchema } from '../../shared/aiSdkReplay'
import { AiError } from './errors'

export function isSdkProvider(provider?: AiProvider) {
  return (
    provider !== undefined
    && !['openai', 'ollama', 'lmstudio'].includes(provider)
  )
}

export function sdkMessages(
  messages: AiMessage[],
  connection: AiConnection,
): ModelMessage[] {
  const names = new Map<string, string>()
  return messages.map((message): ModelMessage => {
    for (const call of message.tool_calls ?? [])
      names.set(call.id, call.function.name)
    if (message.role === 'user')
      return { role: 'user', content: message.content }
    if (message.role === 'tool') {
      const name = names.get(message.tool_call_id!)
      if (!name)
        throw new AiError('invalidRequest')
      return {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.tool_call_id!,
            toolName: name,
            output: { type: 'text', value: message.content },
          },
        ],
      }
    }
    const replay = message.sdkResponse
    if (
      replay
      && replay.provider === connection.provider
      && replay.model === connection.model
    ) {
      return {
        role: 'assistant',
        content: replay.content,
        providerOptions: replay.providerOptions,
      }
    }
    return {
      role: 'assistant',
      content: [
        ...(message.content
          ? [{ type: 'text' as const, text: message.content }]
          : []),
        ...(message.tool_calls ?? []).map(call => ({
          type: 'tool-call' as const,
          toolCallId: call.id,
          toolName: call.function.name,
          input: JSON.parse(call.function.arguments),
        })),
      ],
    }
  })
}

export async function generateSdkResponse(
  connection: AiConnection,
  options: Parameters<typeof generateAiResponse>[1],
) {
  const span = connection.trace?.nextSpan()
  const started = Date.now()
  const controller = new AbortController()
  const signal = AbortSignal.any([options.signal, controller.signal])
  // Direct provider requests only: no SDK gateway, ambient credentials, or redirects.
  const guardedFetch: typeof fetch = async (input, init) => {
    const url = String(input)
    const base = new URL(connection.baseURL)
    if (new URL(url).origin !== base.origin)
      throw new AiError('invalidRequest')
    const requestBody = typeof init?.body === 'string' ? init.body : ''
    if (Buffer.byteLength(requestBody) > AI_LIMITS.inputBytes)
      throw new AiError('inputLimit')
    connection.trace?.event(
      'request.start',
      {
        span,
        operation: options.operation,
        endpoint: new URL(url).pathname,
        inputBytes: Buffer.byteLength(requestBody),
      },
      requestBody,
    )
    const response = await fetch(input, { ...init, redirect: 'error', signal })
    connection.trace?.event('request.headers', {
      span,
      status: response.status,
      requestId:
        response.headers.get('request-id')
        ?? response.headers.get('x-request-id'),
    })
    let bytes = 0
    const body = response.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) {
          bytes += chunk.byteLength
          if (bytes > AI_LIMITS.outputBytes)
            throw new AiError('outputLimit')
          ctl.enqueue(chunk)
        },
      }),
    )
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
  const config = {
    apiKey: connection.apiKey ?? '',
    baseURL: connection.baseURL,
    fetch: guardedFetch,
  }
  const model
    = connection.provider === 'anthropic'
      ? createAnthropic(config)(connection.model)
      : connection.provider === 'gemini'
        ? createGoogleGenerativeAI(config)(connection.model)
        : connection.provider === 'deepseek'
          ? createDeepSeek(config)(connection.model)
          : connection.provider === 'mistral'
            ? createMistral(config)(connection.model)
            : createXai(config)(connection.model)
  const tools: ToolSet = Object.fromEntries(
    (options.tools ?? []).map(({ function: fn }) => [
      fn.name,
      {
        description:
          typeof fn.description === 'string' ? fn.description : undefined,
        inputSchema: jsonSchema(
          fn.parameters as Parameters<typeof jsonSchema>[0],
        ),
        // Runtime validation in massCode remains authoritative for every provider.
      },
    ]),
  )
  let answer = ''
  try {
    const result = streamText({
      model,
      system: options.instructions,
      messages: sdkMessages(options.messages, connection),
      ...(Object.keys(tools).length
        ? { tools, toolChoice: options.toolChoice ?? 'auto' }
        : {}),
      maxRetries: 0,
      maxOutputTokens: 8192,
      abortSignal: signal,
      // SDK defaults log raw error bodies; only our redacted trace may log failures.
      onError: () => {},
    })
    for await (const part of result.fullStream) {
      if (part.type === 'error')
        throw part.error
      if (part.type === 'abort')
        throw new AiError('connection')
      if (part.type === 'text-delta') {
        answer += part.text
        options.onDelta(part.text)
      }
    }
    signal.throwIfAborted()
    const reason = await result.finishReason
    if (!['stop', 'tool-calls'].includes(reason)) {
      throw new AiError(
        reason === 'length' ? 'outputLimit' : 'invalidResponse',
      )
    }
    const response = await result.response
    const assistant = response.messages.find(
      message => message.role === 'assistant',
    )
    if (!assistant || typeof assistant.content === 'string')
      throw new AiError('invalidResponse')
    const replay = aiSdkReplaySchema.parse({
      provider: connection.provider,
      model: connection.model,
      content: assistant.content,
      providerOptions: assistant.providerOptions,
    })
    const calls: AiProtocolCall[] = replay.content.flatMap(part =>
      part.type === 'tool-call'
        ? [
            aiProtocolCallSchema.parse({
              id: part.toolCallId,
              type: 'function',
              function: {
                name: part.toolName,
                arguments: JSON.stringify(part.input),
              },
            }),
          ]
        : [],
    )
    if (
      calls.length > 8
      || new Set(calls.map(call => call.id)).size !== calls.length
    ) {
      throw new AiError('invalidResponse')
    }
    if (!answer && !calls.length)
      throw new AiError('invalidResponse')
    connection.trace?.event(
      'request.complete',
      {
        span,
        durationMs: Date.now() - started,
        toolCalls: calls.map(call => call.function.name),
        usage: await result.usage,
      },
      { answer, calls },
    )
    return { answer, calls, replay, usage: undefined }
  }
  catch (error) {
    connection.trace?.event(
      options.signal.aborted ? 'request.cancelled' : 'request.error',
      {
        span,
        durationMs: Date.now() - started,
        code: error instanceof AiError ? error.code : 'upstream',
      },
    )
    if (error instanceof AiError)
      throw error
    if (APICallError.isInstance(error)) {
      const status = error.statusCode
      throw new AiError(
        status === 401 || status === 403
          ? 'authentication'
          : status === 429
            ? 'rateLimit'
            : status === 404
              ? 'modelUnavailable'
              : 'upstream',
        status ? `HTTP ${status}` : undefined,
      )
    }
    throw new AiError('invalidResponse')
  }
  finally {
    controller.abort()
  }
}
