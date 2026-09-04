import type { HttpRequestDraft } from '@/composables'
import {
  buildCurlPreview,
  buildHttpPreview,
  buildRequestPreview,
  getRequestPreviewWarnings,
} from '../requestPreview'

function createDraft(
  overrides: Partial<HttpRequestDraft> = {},
): HttpRequestDraft {
  return {
    name: 'Request',
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
        name: 'Create user',
        method: 'POST',
        url: 'https://api.example.com/users?name=Anton',
        headers: [{ key: 'X-Token', value: 'a\'b' }],
        bodyType: 'json',
        body: '{\n  "name": "Anton"\n}',
      }),
    )

    expect(preview).toBe(
      [
        '## Create user',
        'curl -X "POST" "https://api.example.com/users?name=Anton" \\',
        '     -H \'X-Token: a\'\\\'\'b\' \\',
        '     -H \'Content-Type: application/json\' \\',
        '     -d $\'{',
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
        name: 'Create user',
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
        name: 'Upload',
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

    expect(formPreview).toContain('-F \'title=Anton\'')
    expect(formPreview).toContain('-F \'file=@{{filePath}}\'')
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
