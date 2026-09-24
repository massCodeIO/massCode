import type { HttpRequestDraft } from '@/composables'
import { describe, expect, it, vi } from 'vitest'
import {
  buildCurlPreview,
  buildHarRequest,
  buildHttpPreview,
  buildRequestPreview,
  getRequestPreviewWarnings,
  resolveHttpPreviewUrl,
} from '../requestPreview'

function createDraft(
  overrides: Partial<HttpRequestDraft> = {},
): HttpRequestDraft {
  return {
    folderId: null,
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
    formData: [],
    auth: { type: 'none' },
    description: '',
    ...overrides,
  }
}

describe('request preview', () => {
  it('keeps encoded query bytes in URL lookup and generated previews when encoding is off', () => {
    const draft = createDraft({ query: [{ key: 'q', value: 'a%20b+c' }] })
    const options = { encodeUrl: false }
    expect(resolveHttpPreviewUrl(draft, options)).toBe(
      'https://api.example.com/users?q=a%20b+c',
    )
    expect(buildHarRequest(draft, options).url).toBe(
      'https://api.example.com/users?q=a%20b+c',
    )
    for (const format of ['http', 'curl', 'fetch', 'axios'] as const) {
      expect(buildRequestPreview(draft, format, options)).toContain(
        'q=a%20b+c',
      )
    }
    expect(resolveHttpPreviewUrl(draft)).toContain('q=a%2520b%2Bc')
  })
  it('resolves the cookie lookup URL without interpreting the request body', () => {
    expect(
      resolveHttpPreviewUrl(
        createDraft({
          url: '{{baseUrl}}/api',
          bodyType: 'binary',
          body: 'file',
        }),
        { variables: { baseUrl: 'https://example.com' } },
      ),
    ).toBe('https://example.com/api')
  })

  it('merges automatic cookies with enabled manual headers across preview formats', () => {
    const draft = createDraft({
      headers: [
        { key: 'Cookie', value: 'manual=one' },
        { key: 'cookie', value: 'second=two' },
        { key: 'Cookie', value: 'disabled=three', enabled: false },
      ],
    })
    const options = { automaticCookie: 'session=abc' }
    for (const output of [
      buildHttpPreview(draft, options),
      buildCurlPreview(draft, options),
      buildRequestPreview(draft, 'fetch', options),
      buildRequestPreview(draft, 'axios', options),
    ]) {
      expect(output).toContain('session=abc; manual=one; second=two')
      expect(output).not.toContain('disabled=three')
    }
    expect(buildHarRequest(draft, options).headers).toContainEqual({
      name: 'Cookie',
      value: 'session=abc; manual=one; second=two',
    })
    expect(buildHttpPreview(draft)).not.toContain('session=abc')
    expect(draft.headers).toHaveLength(3)
  })

  it('previews every duplicate header value and safely interpolates encoded forms', () => {
    const draft = createDraft({
      method: 'POST',
      headers: [
        { key: 'X-QA', value: 'first' },
        { key: 'x-qa', value: 'second' },
      ],
      bodyType: 'form-urlencoded',
      body: 'special=a%26b%3Dc%2Bd%25&variable={{value}}',
    })
    const options = { variables: { value: 'a&b=c+d% Привет' } }
    const preview = buildHttpPreview(draft, options)
    expect(preview).toContain('X-QA: first, second')
    expect(new URLSearchParams(preview.split('\n\n')[1]).get('variable')).toBe(
      options.variables.value,
    )
    expect(buildCurlPreview(draft, options)).toContain('X-QA: first, second')
    for (const format of ['fetch', 'axios'] as const) {
      expect(buildRequestPreview(draft, format, options)).toContain(
        'first, second',
      )
    }
  })

  it('builds raw HTTP preview with query, headers, auth, and body', () => {
    const preview = buildHttpPreview(
      createDraft({
        method: 'POST',
        query: [{ key: 'page size', value: '10', enabled: true }],
        headers: [{ key: 'Accept', value: 'application/json' }],
        auth: { type: 'bearer', token: 'token' },
        bodyType: 'json',
        body: '{"ok":true}',
      }),
    )

    expect(preview).toBe(
      [
        'POST /users?page+size=10 HTTP/1.1',
        'Host: api.example.com',
        'Accept: application/json',
        'Authorization: Bearer token',
        'Content-Type: application/json',
        '',
        '{"ok":true}',
      ].join('\n'),
    )
  })

  it('builds Paw-style curl preview with shell-quoted values', () => {
    const preview = buildCurlPreview(
      createDraft({
        method: 'POST',
        url: 'https://api.example.com/users?name=Anton',
        headers: [{ key: 'X-Token', value: 'a\'b' }],
        bodyType: 'json',
        body: '{\n  "name": "Anton"\n}',
      }),
      { name: 'Create user' },
    )

    expect(preview).toBe(
      [
        '## Create user',
        'curl -X "POST" "https://api.example.com/users?name=Anton" \\',
        '     -H \'X-Token: a\'\\\'\'b\' \\',
        '     -H \'Content-Type: application/json\' \\',
        '     --data-raw $\'{',
        '  "name": "Anton"',
        '}\'',
      ].join('\n'),
    )
  })

  it('interpolates active environment variables in raw HTTP preview', () => {
    const preview = buildHttpPreview(
      createDraft({
        method: 'GET',
        url: '{{apiBaseUrl}}/users/{{userId}}',
        query: [{ key: 'limit', value: '{{limit}}', enabled: true }],
        headers: [{ key: 'X-Token', value: '{{token}}' }],
        auth: { type: 'bearer', token: '{{token}}' },
      }),
      {
        variables: {
          apiBaseUrl: 'https://api.example.com',
          limit: '10',
          token: 'secret',
          userId: '42',
        },
      },
    )

    expect(preview).toBe(
      [
        'GET /users/42?limit=10 HTTP/1.1',
        'Host: api.example.com',
        'X-Token: secret',
        'Authorization: Bearer secret',
      ].join('\n'),
    )
  })

  it('interpolates body and form data values in curl preview', () => {
    const jsonPreview = buildCurlPreview(
      createDraft({
        method: 'POST',
        url: '{{apiBaseUrl}}/users',
        bodyType: 'json',
        body: '{\n  "name": "{{name}}",\n  "role": "{{missing}}"\n}',
      }),
      {
        variables: {
          apiBaseUrl: 'https://api.example.com',
          name: 'Anton',
        },
      },
    )

    expect(jsonPreview).toContain(
      'curl -X "POST" "https://api.example.com/users"',
    )
    expect(jsonPreview).toContain('"name": "Anton"')
    expect(jsonPreview).toContain('"role": "{{missing}}"')

    const formPreview = buildCurlPreview(
      createDraft({
        method: 'POST',
        url: '{{apiBaseUrl}}/upload',
        bodyType: 'multipart',
        formData: [
          { key: 'title', type: 'text', value: '{{name}}' },
          { key: 'file', type: 'file', value: '{{filePath}}' },
        ],
      }),
      {
        variables: {
          apiBaseUrl: 'https://api.example.com',
          filePath: '/tmp/demo.txt',
          name: 'Anton',
        },
      },
    )

    expect(formPreview).toContain('--form-string \'title=Anton\'')
    expect(formPreview).toContain('-F \'file=@"{{filePath}}"\'')
  })
})

describe('javaScript request previews', () => {
  it.each(['fetch', 'axios'] as const)(
    'generates valid %s for live draft data without changing it',
    async (format) => {
      const draft = createDraft({
        method: 'POST',
        url: '{{baseUrl}}/users',
        query: [
          { key: 'q', value: 'a & b' },
          { key: 'ignored', value: 'x', enabled: false },
        ],
        headers: [
          { key: 'X-Note', value: 'quote"\nline' },
          { key: 'X-Ignored', value: 'x', enabled: false },
        ],
        auth: { type: 'bearer', token: '{{token}}' },
        bodyType: 'json',
        // Intentionally resembles template code: it must remain literal data.
        // eslint-disable-next-line no-template-curly-in-string
        body: '{"unsaved":"` ${value} \\\\""}',
      })
      const before = JSON.stringify(draft)
      const code = buildRequestPreview(draft, format, {
        variables: { baseUrl: 'https://example.test', token: '••••••••' },
      })
      const request = vi.fn(async (...args: unknown[]) => args)
      const executable = code.replace('import axios from "axios";\n\n', '')
      // Execute only our generated fixture against a stub, never the network.
      // eslint-disable-next-line no-new-func
      const run = new Function(
        format,
        `return (async () => { ${executable}\nreturn response; })()`,
      )
      await run(request)
      const args = request.mock.calls[0]!
      const config = (format === 'fetch' ? args[1] : args[0]) as Record<
        string,
        unknown
      >
      expect(format === 'fetch' ? args[0] : config.url).toBe(
        'https://example.test/users?q=a+%26+b',
      )
      expect(config.method).toBe('POST')
      expect(config.headers).toEqual({
        'X-Note': 'quote"\nline',
        'Authorization': 'Bearer ••••••••',
        'Content-Type': 'application/json',
      })
      expect(config[format === 'fetch' ? 'body' : 'data']).toBe(draft.body)
      expect(JSON.stringify(draft)).toBe(before)
    },
  )

  it('leaves unresolved variables visible and reflects edits before autosave', () => {
    const draft = createDraft({ url: '{{baseUrl}}/{{id}}' })
    expect(buildRequestPreview(draft, 'fetch')).toContain('{{id}}')
    draft.url = 'https://example.test/unsaved'
    expect(buildRequestPreview(draft, 'axios')).toContain(
      'https://example.test/unsaved',
    )
  })

  it.each(['fetch', 'axios'] as const)(
    'creates %s multipart snippets with explicit file arguments',
    (format) => {
      const draft = createDraft({
        method: 'POST',
        bodyType: 'multipart',
        headers: [
          { key: 'Content-Type', value: 'multipart/form-data; boundary=old' },
        ],
        formData: [
          { key: 'title', type: 'text', value: 'demo' },
          { key: 'upload', type: 'file', value: '/private/local/file.txt' },
        ],
      })
      const code = buildRequestPreview(draft, format)
      expect(code).toContain('async function sendRequest(file1)')
      expect(code).toContain('body.append("upload", file1)')
      expect(code).toContain('body.append("title", "demo")')
      expect(code).not.toContain('/private/local')
      expect(code).not.toContain('Content-Type')
      expect(getRequestPreviewWarnings(draft, format)).toEqual([
        'multipartFiles',
        'multipartContentType',
      ])
    },
  )

  it('warns when fetch cannot represent a GET body', () => {
    expect(
      getRequestPreviewWarnings(
        createDraft({ bodyType: 'text', body: 'body' }),
        'fetch',
      ),
    ).toEqual(['fetchBody'])
    expect(
      getRequestPreviewWarnings(
        createDraft({ bodyType: 'text', body: 'body' }),
        'curl',
      ),
    ).toEqual([])
  })
})

describe('graphQL code generation', () => {
  it('rejects a non-POST GraphQL draft instead of generating a different method', () => {
    expect(() =>
      buildRequestPreview(createDraft({ bodyType: 'graphql' }), 'fetch'),
    ).toThrow('GRAPHQL_METHOD')
  })
  const draft = createDraft({
    method: 'POST',
    bodyType: 'graphql',
    body: JSON.stringify({
      query: 'query Q($id: ID!) { user(id: $id) { name } }',
      variables: '{"id":"{{id}}"}',
      operationName: 'Q',
    }),
  })
  it.each(['http', 'curl', 'fetch', 'axios'] as const)(
    'encodes the GraphQL envelope for %s',
    (format) => {
      const preview = buildRequestPreview(draft, format, {
        variables: { id: '42' },
      })
      expect(preview).toContain('application/json')
      expect(preview).toContain('application/graphql-response+json')
      expect(preview).toContain('42')
      expect(preview).not.toContain('{{id}}')
      expect(preview).toContain('operationName')
    },
  )
})

it.each([
  { type: 'bearer' as const, token: 'synthetic-token' },
  { type: 'basic' as const, username: 'user', password: 'pass' },
])(
  'uses one generated $type Authorization across all preview formats',
  (auth) => {
    const draft = createDraft({
      auth,
      headers: [
        { key: 'authorization', value: 'manual-one' },
        { key: 'AUTHORIZATION', value: 'manual-two' },
        { key: 'aUtHoRiZaTiOn', value: 'disabled', enabled: false },
      ],
    })
    const expected
      = auth.type === 'bearer' ? 'Bearer synthetic-token' : 'Basic dXNlcjpwYXNz'
    expect(
      buildHarRequest(draft).headers.filter(
        header => header.name.toLowerCase() === 'authorization',
      ),
    ).toEqual([{ name: 'Authorization', value: expected }])
    for (const format of ['http', 'curl', 'fetch', 'axios'] as const) {
      const preview = buildRequestPreview(draft, format)
      expect(preview).toContain(expected)
      expect(preview).not.toMatch(/manual-one|manual-two|disabled/)
    }
  },
)
it.each([{ type: 'none' as const }, { type: 'bearer' as const, token: '' }])(
  'retains manual Authorization when $type produces no header',
  (auth) => {
    const draft = createDraft({
      auth,
      headers: [{ key: 'authorization', value: 'manual-one' }],
    })
    for (const format of ['http', 'curl', 'fetch', 'axios'] as const)
      expect(buildRequestPreview(draft, format)).toContain('manual-one')
  },
)
