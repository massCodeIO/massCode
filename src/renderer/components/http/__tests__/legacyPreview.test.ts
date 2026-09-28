import type { HttpRequestPreviewFormat } from '~/shared/httpPreview'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { generateHttpSnippet } from '~/main/http/preview'
import { HTTP_PREVIEW_FORMATS } from '~/shared/httpPreview'
import { buildHarRequest } from '../requestPreview'
import { base } from './previewCases'

const patchedFormats: HttpRequestPreviewFormat[] = [
  'clojure:clj_http',
  'csharp:httpclient',
  'r:httr',
  'kotlin:okhttp',
  'php:curl',
  'powershell:restmethod',
  'ruby:native',
  'crystal:native',
  'rust:reqwest',
  'objc:nsurlsession',
]

const rawBodies = [
  'false',
  'null',
  '[1, "two", null]',
  '{"invalid":',
  'tag=a%26b&tag=c+d&empty=',
]

describe('legacy HTTP preview fidelity', () => {
  it.each(patchedFormats)(
    '%s preserves raw body bytes and explicit MIME parameters',
    (format) => {
      for (const body of rawBodies) {
        const mimeType = body.startsWith('tag=')
          ? 'application/x-www-form-urlencoded; charset=utf-8'
          : 'application/json; charset=utf-8'
        const request = buildHarRequest({
          ...base,
          bodyType: body.startsWith('tag=') ? 'form-urlencoded' : 'json',
          body,
          headers: [{ key: 'Content-Type', value: mimeType }],
        })
        const content = generateHttpSnippet({ request, format })
        expect(content).toContain(mimeType)
        expect(content).toContain(
          format === 'powershell:restmethod'
            ? body
            : JSON.stringify(body).slice(1, -1),
        )
        if (format === 'r:httr')
          expect(content).toContain('encode <- "raw"')
        if (format === 'csharp:httpclient') {
          expect(content).toContain(
            `MediaTypeHeaderValue.Parse("${mimeType}")`,
          )
        }
      }
    },
  )

  it.each(patchedFormats)(
    '%s escapes body and header literals at their generation site',
    (format) => {
      const value
        = 'back\\path "quote" \'apostrophe\' $TOKEN #{danger}\nПривет 😀'
      const request = buildHarRequest({
        ...base,
        bodyType: 'text',
        body: value,
        headers: [{ key: 'X-Test', value }],
      })
      const content = generateHttpSnippet({ request, format })
      const expected: Partial<Record<HttpRequestPreviewFormat, string>> = {
        'clojure:clj_http':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN #{danger}\\nПривет 😀',
        'csharp:httpclient':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN #{danger}\\nПривет 😀',
        'r:httr':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN #{danger}\\nПривет 😀',
        'kotlin:okhttp':
          'back\\\\path \\"quote\\" \'apostrophe\' \\$TOKEN #{danger}\\nПривет 😀',
        'php:curl':
          'back\\\\path \\"quote\\" \'apostrophe\' \\$TOKEN #{danger}\\x0aПривет 😀',
        'powershell:restmethod':
          'back\\path "quote" \'\'apostrophe\'\' $TOKEN #{danger}\nПривет 😀',
        'ruby:native':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN \\#{danger}\\nПривет 😀',
        'crystal:native':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN \\#{danger}\\nПривет 😀',
        'rust:reqwest':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN #{danger}\\u{a}Привет 😀',
        'objc:nsurlsession':
          'back\\\\path \\"quote\\" \'apostrophe\' $TOKEN #{danger}\\012Привет 😀',
      }
      expect(content.split(expected[format]!).length - 1).toBe(2)
    },
  )

  it.each(patchedFormats)(
    '%s preserves the full query exactly once',
    (format) => {
      const url
        = 'https://example.com/a%2Fb?q=a%26b&slash=%2F&plus=+&empty=&q=last&var={{value}}'
      const request = buildHarRequest({ ...base, url })
      const content = generateHttpSnippet({ request, format })
      expect(content.split(url).length - 1).toBe(1)
      expect(content).not.toContain('%252F')
      expect(content).not.toContain('masscodevariable')
    },
  )

  it.each(HTTP_PREVIEW_FORMATS)(
    '%s does not mutate the HAR or leak state to later calls',
    (format) => {
      const request = buildHarRequest({
        ...base,
        bodyType: 'multipart',
        formData: [{ key: 'title', value: 'hello', type: 'text' }],
      })
      const original = structuredClone(request)
      const first = generateHttpSnippet({ request, format })
      expect(request).toEqual(original)
      expect(generateHttpSnippet({ request, format })).toBe(first)
      expect(request).toEqual(original)
    },
  )

  it.each([
    ['kotlin:okhttp', '{{base}}/\\$TOKEN?apostrophe=\'ok\'#fragment'],
    ['php:curl', '{{base}}/\\$TOKEN?apostrophe=\'ok\'#fragment'],
    ['powershell:restmethod', '{{base}}/$TOKEN?apostrophe=\'\'ok\'\'#fragment'],
    ['ruby:native', '{{base}}/$TOKEN?apostrophe=\'ok\'#fragment'],
    ['crystal:native', '{{base}}/$TOKEN?apostrophe=\'ok\'#fragment'],
  ] as const)(
    '%s escapes unresolved base URLs in language literals',
    (format, escaped) => {
      const request = buildHarRequest({
        ...base,
        url: '{{base}}/$TOKEN?apostrophe=\'ok\'#fragment',
      })
      expect(generateHttpSnippet({ request, format })).toContain(escaped)
    },
  )

  it.each(patchedFormats)(
    '%s restores URL templates before creating language literals',
    (format) => {
      for (const url of [
        '{{base}}/items?q={{value}}',
        '{{scheme}}://{{host}}:{{port}}/items?q={{value}}',
        'https://{{host}}:{{port}}/{{path}}?q={{value}}',
      ]) {
        const request = buildHarRequest({ ...base, url })
        const content = generateHttpSnippet({ request, format })
        expect(content).toContain(url)
        expect(content).not.toContain('masscodevariable')
        expect(content).not.toContain('49152')
      }
    },
  )

  it('preserves the original Python request path and encoded query', () => {
    const request = buildHarRequest({
      ...base,
      url: 'https://{{host}}:{{port}}/a%2Fb?q=a%26b&x=+&x=&q={{value}}',
    })
    const content = generateHttpSnippet({ request, format: 'python:python3' })
    expect(content).toContain('/a%2Fb?q=a%26b&x=+&x=&q={{value}}')
    expect(content).toContain('{{host}}:{{port}}')
  })

  it('does not turn a fragment into a Python query string', () => {
    const request = buildHarRequest({
      ...base,
      url: 'https://example.com/items#fragment?not=query',
    })
    const content = generateHttpSnippet({ request, format: 'python:python3' })
    expect(content).toContain('"/items"')
    expect(content).not.toContain('not=query')
  })

  it('separates Crystal header entries with commas', () => {
    const request = buildHarRequest({
      ...base,
      headers: [
        { key: 'X-One', value: 'one' },
        { key: 'X-Two', value: 'two' },
      ],
    })
    const content = generateHttpSnippet({ request, format: 'crystal:native' })
    expect(content).toContain('"X-One" => "one",\n  "X-Two" => "two",')
  })

  it.skipIf(process.platform === 'win32')(
    'passes original LF, CR, tabs, quotes and backslashes to wget',
    () => {
      const value = 'line1\nline2\r\ttab \'quote\' \\path $TOKEN Привет'
      const request = buildHarRequest({
        ...base,
        bodyType: 'text',
        body: value,
        headers: [{ key: 'X-Test', value }],
      })
      const content = generateHttpSnippet({ request, format: 'shell:wget' })
      // A shell function captures argv instead of invoking wget or making requests.
      const args = execFileSync(
        '/bin/sh',
        ['-c', `wget() { printf '%s\\0' "$@"; }; ${content}`],
        { encoding: 'utf8' },
      ).split('\0')
      expect(args[args.indexOf('--body-data') + 1]).toBe(value)
      expect(args).toContain(`X-Test: ${value}`)
    },
  )

  it.skipIf(process.platform === 'win32')(
    'pipes exact body bytes to HTTPie without echo interpretation or appended LF',
    () => {
      for (const value of [
        '',
        'no newline',
        'line1\nline2\r\ttab \\n $TOKEN \'quote\' Привет',
      ]) {
        const request = buildHarRequest({
          ...base,
          bodyType: 'text',
          body: value,
        })
        const content = generateHttpSnippet({
          request,
          format: 'shell:httpie',
        })
        const received = execFileSync(
          '/bin/sh',
          ['-c', `http() { cat; }; ${content}`],
          { encoding: 'utf8' },
        )
        expect(received).toBe(value)
      }
    },
  )

  it.each(HTTP_PREVIEW_FORMATS)(
    '%s distinguishes an empty body from an absent body',
    (format) => {
      const request = buildHarRequest({
        ...base,
        bodyType: 'json',
        body: '',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
        ],
      })
      const absent = structuredClone(request)
      delete absent.postData.text
      const content = generateHttpSnippet({ request, format })
      expect(content).toContain('application/json; charset=utf-8')
      // Raw HTTP may use identical wire representations for empty and absent bodies.
      if (format !== 'http') {
        expect(content).not.toBe(
          generateHttpSnippet({ request: absent, format }),
        )
      }
      expect(request.postData.text).toBe('')
      if (format === 'csharp:httpclient') {
        expect(content).toContain('Content = new StringContent("")')
        expect(content).toContain(
          'MediaTypeHeaderValue.Parse("application/json; charset=utf-8")',
        )
      }
      if (format === 'kotlin:okhttp' || format === 'java:okhttp') {
        expect(content).toContain('RequestBody.create(mediaType, "")')
        expect(content).toContain('.post(body)')
        expect(content).toContain(
          'MediaType.parse("application/json; charset=utf-8")',
        )
      }
    },
  )

  it('uses native PHP single-quoted values for Guzzle body, headers and URL', () => {
    const value = 'line1\nline2\r\ttab\b\f \'quote\' \\path \\t $TOKEN Привет'
    const request = buildHarRequest({
      ...base,
      url: '{{base}}/items?quote=\'yes\'',
      bodyType: 'text',
      body: value,
      headers: [{ key: 'X-Test', value }],
    })
    const content = generateHttpSnippet({ request, format: 'php:guzzle' })
    // PHP single quotes interpret only escaped apostrophes and backslashes.
    const values = [...content.matchAll(/'((?:[^'\\]|\\[\s\S])*)'/g)].map(
      match => match[1].replace(/\\(['\\])/g, '$1'),
    )
    expect(values.filter(item => item === value)).toHaveLength(2)
    expect(values).toContain(request.url)
  })

  it('selects Ruby TLS from the URL at runtime', () => {
    const request = buildHarRequest({ ...base, url: '{{baseUrl}}/items' })
    expect(generateHttpSnippet({ request, format: 'ruby:native' })).toContain(
      'http.use_ssl = url.scheme == "https"',
    )
  })
})
