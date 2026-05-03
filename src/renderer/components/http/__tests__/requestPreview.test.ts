import type { HttpRequestDraft } from '@/composables'
import { buildCurlPreview, buildHttpPreview } from '../requestPreview'

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
