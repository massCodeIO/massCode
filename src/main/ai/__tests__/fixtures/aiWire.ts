import type { AiProvider } from '../../../../shared/ai'

// Synthetic wire fixtures: no credentials or user data. Replay the real adapters,
// then execute the real orchestration callback, not a canned tool result stream.
function events(
  provider: AiProvider,
  call: boolean,
  name: string,
  args: unknown,
  id: string,
) {
  if (provider === 'openai') {
    return [
      {
        type: 'response.completed',
        response: {
          status: 'completed',
          output: call
            ? [
                {
                  type: 'function_call',
                  id,
                  call_id: id,
                  name,
                  arguments: JSON.stringify(args),
                  status: 'completed',
                },
              ]
            : [
                {
                  type: 'message',
                  id,
                  role: 'assistant',
                  status: 'completed',
                  content: [
                    { type: 'output_text', text: 'Ответ 😀', annotations: [] },
                  ],
                },
              ],
        },
      },
    ]
  }
  if (provider === 'anthropic') {
    return [
      {
        type: 'message_start',
        message: {
          id: 'msg1',
          type: 'message',
          role: 'assistant',
          model: 'test',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 0 },
        },
      },
      {
        type: 'content_block_start',
        index: 0,
        content_block: call
          ? { type: 'tool_use', id, name, input: {} }
          : { type: 'text', text: '' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: call
          ? { type: 'input_json_delta', partial_json: JSON.stringify(args) }
          : { type: 'text_delta', text: 'Ответ 😀' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: {
          stop_reason: call ? 'tool_use' : 'end_turn',
          stop_sequence: null,
        },
        usage: { output_tokens: 4 },
      },
      { type: 'message_stop' },
    ]
  }
  if (provider === 'gemini') {
    return [
      {
        candidates: [
          {
            index: 0,
            content: {
              role: 'model',
              parts: call
                ? [
                    {
                      functionCall: { name, args },
                      thoughtSignature: 'opaque-test-signature',
                    },
                  ]
                : [{ text: 'Ответ 😀' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 4,
          totalTokenCount: 14,
        },
      },
    ]
  }
  return [
    {
      id: 'msg1',
      model: 'test',
      created: 1,
      choices: [
        {
          index: 0,
          delta: call
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id,
                    type: 'function',
                    function: { name, arguments: JSON.stringify(args) },
                  },
                ],
              }
            : { role: 'assistant', content: 'Ответ 😀' },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'msg1',
      model: 'test',
      created: 1,
      choices: [
        { index: 0, delta: {}, finish_reason: call ? 'tool_calls' : 'stop' },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    },
  ]
}
export function wireResponse(
  provider: AiProvider,
  call = false,
  name = 'read_http_context',
  args: unknown = {},
  id = 'call12345',
) {
  const wire
    = events(provider, call, name, args, id)
      .map(
        event =>
          `${provider === 'anthropic' ? `event: ${(event as { type: string }).type}\n` : ''}data: ${JSON.stringify(event)}\n\n`,
      )
      .join('')
      + (['anthropic', 'gemini', 'openai'].includes(provider)
        ? ''
        : 'data: [DONE]\n\n')
  const bytes = new TextEncoder().encode(wire)
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7)
          controller.enqueue(bytes.slice(i, i + 7))
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  )
}
