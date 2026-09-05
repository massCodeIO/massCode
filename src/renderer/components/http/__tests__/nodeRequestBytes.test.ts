import type { HttpRequestDraft } from '@/composables'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { generateHttpSnippet } from '~/main/http/preview'
import { buildHarRequest } from '../requestPreview'
import { base, cases } from './previewCases'

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
const binary = Buffer.from([0, 1, 2, 255, 10, 13, 65, 66])

async function captureRequest(
  draft: HttpRequestDraft,
  format: 'node:native' | 'node:fetch' | 'node:axios',
) {
  let captured!: Request
  const capture = (
    url: URL | string,
    options: { method: string, headers: HeadersInit, body?: BodyInit },
  ) => {
    captured = new Request(url, options)
    return new Response('ok')
  }
  const native = {
    request(url: URL, options: { method: string, headers: HeadersInit }) {
      return {
        on() {},
        end(body?: BodyInit) {
          capture(url, { ...options, body })
        },
      }
    },
  }
  const code = generateHttpSnippet({
    request: buildHarRequest(draft),
    format,
  }).replace(/^import .*;\n/gm, '')
  await new AsyncFunction(
    'fetch',
    'axios',
    'http',
    'https',
    'readFile',
    'console',
    code,
  )(
    capture,
    {
      request: (options: {
        url: string
        method: string
        headers: HeadersInit
        data?: BodyInit
      }) => capture(options.url, { ...options, body: options.data }),
    },
    native,
    native,
    async () => binary,
    { log() {}, error() {} },
  )
  return captured
}

describe('generated Node request bytes', () => {
  for (const name of [
    'json',
    'jsonArray',
    'jsonScalar',
    'jsonInvalid',
    'text',
    'form',
    'multipart',
    'multipartFile',
    'multipartQuotes',
  ]) {
    it.each(['node:native', 'node:axios', 'node:fetch'] as const)(
      `${name}: %s preserves the body`,
      async (format) => {
        const draft = { ...base, ...cases[name] }
        const request = await captureRequest(draft, format)
        if (draft.bodyType !== 'multipart') {
          expect(await request.text()).toBe(draft.body)
          return
        }
        const form = await request.formData()
        for (const entry of draft.formData) {
          const values = form.getAll(entry.key)
          if (entry.type === 'text') {
            // FormData normalizes text line endings, matching the HTTP executor.
            expect(values).toContain(
              entry.value.replace(/\r\n|\r|\n/g, '\r\n'),
            )
          }
          else {
            const file = values[0] as File
            expect(Buffer.from(await file.arrayBuffer())).toEqual(binary)
          }
        }
        expect([...form.keys()]).toHaveLength(draft.formData.length)
      },
    )
  }
})
