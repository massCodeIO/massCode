import type { HttpRequestDraft } from '@/composables'
import { parse } from 'acorn'
import { describe, expect, it } from 'vitest'
import { generateHttpSnippet } from '~/main/http/preview'
import { HTTP_PREVIEW_FORMATS } from '~/shared/httpPreview'
import { buildHarRequest, buildRequestPreview } from '../requestPreview'

const draft: HttpRequestDraft = {
  folderId: null,
  method: 'POST',
  url: 'https://example.com/items',
  query: [
    { key: 'tag', value: 'one' },
    { key: 'tag', value: 'two' },
  ],
  headers: [
    { key: 'X-Test', value: '{{value}}' },
    { key: 'X-Off', value: 'disabled', enabled: false },
  ],
  bodyType: 'json',
  body: '{"message":"hello"}',
  formData: [],
  auth: { type: 'bearer', token: '{{token}}' },
  description: '',
}

describe('hTTP snippet generation', () => {
  it.each(HTTP_PREVIEW_FORMATS)(
    'generates %s when a variable contains the entire base URL',
    (format) => {
      const request = buildHarRequest({
        ...draft,
        url: '{{commerceApiUrl}}/orders',
        query: [],
      })
      if (format === 'python:python3') {
        expect(() => generateHttpSnippet({ request, format })).toThrow(
          'HTTP_PREVIEW_URL_TEMPLATE_UNSUPPORTED',
        )
        return
      }
      const content = generateHttpSnippet({ request, format })
      expect(content).toContain('{{commerceApiUrl}}')
      expect(content).toContain('/orders')
      expect(content).not.toContain('https://{{commerceApiUrl}}')
      expect(content).not.toContain('masscodevariable')
    },
  )

  it.each(['node:axios', 'node:fetch'] as const)(
    'preserves a base URL template in %s without interpolation',
    (format) => {
      const request = buildHarRequest({
        ...draft,
        url: '{{commerceApiUrl}}/orders',
        query: [],
      })
      const content = generateHttpSnippet({ request, format })
      expect(content).toContain('new URL("{{commerceApiUrl}}/orders")')
      expect(() =>
        parse(content, { ecmaVersion: 'latest', sourceType: 'module' }),
      ).not.toThrow()
    },
  )

  it.each(['node:axios', 'node:fetch'] as const)(
    'generates %s as a consistent ES module',
    (format) => {
      const content = generateHttpSnippet({
        request: buildHarRequest(draft),
        format,
      })
      expect(content).toContain(
        format === 'node:axios'
          ? 'import axios from "axios"'
          : 'await fetch(url,',
      )
      expect(content).not.toContain('require(')
      expect(() =>
        parse(content, { ecmaVersion: 'latest', sourceType: 'module' }),
      ).not.toThrow()
    },
  )

  it('formats Swift request arguments without column-aligned padding', () => {
    const content = generateHttpSnippet({
      request: buildHarRequest(draft),
      format: 'swift:nsurlsession',
    })
    expect(content).toContain('var request = URLRequest(url: url)')
    expect(content).toContain('try await URLSession.shared.data(for: request)')
    expect(content).not.toMatch(/^ {10,}\S/m)
  })

  it.each(HTTP_PREVIEW_FORMATS)(
    'generates %s with an unresolved URL variable',
    (format) => {
      const request = buildHarRequest({
        ...draft,
        method: 'GET',
        url: 'https://httpbin.org/anything?copied={{demo}}&encoded=a%26b',
        query: [],
        bodyType: 'none',
        body: null,
      })
      const content = generateHttpSnippet({ request, format })
      expect(content).toContain('httpbin.org')
      expect(content).toContain('{{demo}}')
      expect(content).not.toContain('%2526')
    },
  )

  it.each(HTTP_PREVIEW_FORMATS)(
    'generates %s for a GET without a body',
    (format) => {
      const request = buildHarRequest({
        ...draft,
        method: 'GET',
        bodyType: 'none',
        body: null,
        headers: [],
        auth: { type: 'none' },
      })
      const content = generateHttpSnippet({ request, format })
      expect(content).toContain('example.com')
      expect(content).not.toContain('hello')
    },
  )

  it.each(HTTP_PREVIEW_FORMATS)('generates %s with request data', (format) => {
    const options = {
      variables: { value: 'header-value', token: 'secret-token' },
    }
    const content = ['http', 'curl', 'fetch', 'axios'].includes(format)
      ? buildRequestPreview(
          draft,
          format as 'http' | 'curl' | 'fetch' | 'axios',
          options,
        )
      : generateHttpSnippet({
          request: buildHarRequest(draft, options),
          format,
        })
    expect(content).toContain('example.com')
    expect(content).toContain('header-value')
    expect(content).toContain('secret-token')
    expect(content).toContain('hello')
    expect(content).not.toContain('X-Off')
  })

  it('preserves repeated query parameters without duplicating them', () => {
    const request = buildHarRequest(draft)
    expect(request.url).toBe('https://example.com/items?tag=one&tag=two')
    expect(request.queryString).toEqual([])
    expect(request.headers).toContainEqual({
      name: 'X-Test',
      value: '{{value}}',
    })
  })

  it('decodes form fields once and preserves repeated values', () => {
    const request = buildHarRequest({
      ...draft,
      bodyType: 'form-urlencoded',
      body: 'tag=a%26b&tag=c+d&empty=',
    })
    expect(request.postData.params).toEqual([
      { name: 'tag', value: 'a&b' },
      { name: 'tag', value: 'c d' },
      { name: 'empty', value: '' },
    ])
  })

  it('passes multipart file paths as metadata without reading files', () => {
    const request = buildHarRequest(
      {
        ...draft,
        bodyType: 'multipart',
        headers: [
          { key: 'Content-Type', value: 'multipart/form-data; boundary=stale' },
        ],
        formData: [
          { key: 'title', value: '{{value}}', type: 'text' },
          { key: 'file', value: '/missing/{{file}}.txt', type: 'file' },
        ],
      },
      { variables: { value: 'hello', file: 'interpolated' } },
    )
    expect(
      request.headers.some(header => header.name === 'Content-Type'),
    ).toBe(false)
    expect(request.postData.params).toEqual([
      { name: 'title', value: 'hello' },
      { name: 'file', fileName: '/missing/{{file}}.txt' },
    ])
    expect(
      generateHttpSnippet({ request, format: 'python:requests' }),
    ).toContain('hello')
  })

  it('serializes GraphQL variables and auth before conversion', () => {
    const request = buildHarRequest(
      {
        ...draft,
        bodyType: 'graphql',
        body: JSON.stringify({
          query: 'query { viewer { name } }',
          variables: '{"name":"{{value}}"}',
          operationName: '',
        }),
      },
      { variables: { value: 'Anton', token: 'token' } },
    )
    expect(request.postData.mimeType).toBe('application/json')
    expect(request.postData.text).toContain('Anton')
    expect(request.headers).toContainEqual({
      name: 'Authorization',
      value: 'Bearer token',
    })
  })
})
