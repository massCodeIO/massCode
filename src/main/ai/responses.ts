import type { AiMessage, AiProtocolCall } from '../../shared/ai'
import type { AiResponseReplay } from '../../shared/aiResponses'
import { Buffer } from 'node:buffer'
import { AI_LIMITS } from '../../shared/ai'
import { aiResponseReplaySchema } from '../../shared/aiResponses'
import { AiError } from './errors'

// Terminal events repeat the complete output, including opaque reasoning.
const MAX_RESPONSE_EVENT_BYTES = AI_LIMITS.outputBytes * 2

export function responsesInput(
  messages: AiMessage[],
  model: string,
): unknown[] {
  return messages.flatMap((message): unknown[] => {
    if (message.role === 'tool') {
      return [
        {
          type: 'function_call_output',
          call_id: message.tool_call_id,
          output: message.content,
        },
      ]
    }
    if (message.role === 'assistant' && message.openaiResponse?.model === model)
      return message.openaiResponse.items
    return [
      ...(message.content
        ? [{ role: message.role, content: message.content }]
        : []),
      ...(message.tool_calls ?? []).map(call => ({
        type: 'function_call',
        call_id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
    ]
  })
}

export async function readResponsesStream(
  body: ReadableStream<Uint8Array>,
  model: string,
  onDelta: (text: string) => void,
): Promise<{
    calls: AiProtocolCall[]
    replay: AiResponseReplay
    usage?: Record<string, number>
  }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let lines: string[] = []
  let eventBytes = 0
  let totalBytes = 0
  let answer = ''
  let replay: AiResponseReplay | undefined
  let usage: Record<string, number> | undefined
  function dispatch() {
    const data = lines.join('\n')
    lines = []
    eventBytes = 0
    if (!data)
      return
    let event
    try {
      event = JSON.parse(data)
    }
    catch {
      throw new AiError('invalidResponse')
    }
    if (event.type === 'error' || event.type === 'response.failed')
      throw new AiError('upstream')
    if (event.type === 'response.incomplete') {
      throw new AiError(
        event.response?.incomplete_details?.reason === 'max_output_tokens'
          ? 'outputLimit'
          : 'invalidResponse',
      )
    }
    if (
      ['response.output_text.delta', 'response.refusal.delta'].includes(
        event.type,
      )
    ) {
      if (typeof event.delta !== 'string')
        throw new AiError('invalidResponse')
      answer += event.delta
      if (Buffer.byteLength(answer) > AI_LIMITS.outputBytes)
        throw new AiError('outputLimit')
      onDelta(event.delta)
    }
    if (event.type === 'response.completed') {
      if (event.response?.status !== 'completed')
        throw new AiError('invalidResponse')
      const parsed = aiResponseReplaySchema.safeParse({
        model,
        items: event.response.output,
      })
      if (!parsed.success)
        throw new AiError('invalidResponse')
      replay = parsed.data
      if (Buffer.byteLength(JSON.stringify(replay)) > AI_LIMITS.outputBytes)
        throw new AiError('outputLimit')
      const canonical = replay.items
        .flatMap(item =>
          item.type === 'message'
            ? item.content.map(part =>
                part.type === 'output_text' ? part.text : part.refusal,
              )
            : [],
        )
        .join('')
      if (answer && answer !== canonical)
        throw new AiError('invalidResponse')
      if (!answer && canonical)
        onDelta(canonical)
      const source = event.response.usage
      if (source && typeof source === 'object') {
        usage = Object.fromEntries(
          ['input_tokens', 'output_tokens', 'total_tokens'].flatMap(key =>
            typeof source[key] === 'number' ? [[key, source[key]]] : [],
          ),
        )
      }
    }
  }
  function consume(eof = false) {
    // dispatch() updates replay after a terminal event.

    while (!replay) {
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
      if (eventBytes > MAX_RESPONSE_EVENT_BYTES)
        throw new AiError('outputLimit')
      if (!line)
        dispatch()
      else if (line.startsWith('data:'))
        lines.push(line.slice(5).replace(/^ /, ''))
    }
    if (Buffer.byteLength(pending) + eventBytes > MAX_RESPONSE_EVENT_BYTES)
      throw new AiError('outputLimit')
  }
  try {
    // dispatch() updates replay after a terminal event.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!replay) {
      const { value, done } = await reader.read()
      if (done) {
        pending += `${decoder.decode()}\n\n`
        consume(true)
        if (!replay)
          throw new AiError('invalidResponse')
        break
      }
      totalBytes += value.byteLength
      if (totalBytes > AI_LIMITS.outputBytes * 4)
        throw new AiError('outputLimit')
      pending += decoder.decode(value, { stream: true })
      consume()
    }
    const calls: AiProtocolCall[] = replay!.items.flatMap(item =>
      item.type === 'function_call'
        ? [
            {
              id: item.call_id,
              type: 'function',
              function: { name: item.name, arguments: item.arguments },
            },
          ]
        : [],
    )
    if (
      calls.length > 8
      || new Set(calls.map(call => call.id)).size !== calls.length
    ) {
      throw new AiError('invalidResponse')
    }
    if (
      !calls.length
      && !replay!.items.some(
        item => item.type === 'message' && item.content.length,
      )
    ) {
      throw new AiError('invalidResponse')
    }
    return { calls, replay: replay!, usage }
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
