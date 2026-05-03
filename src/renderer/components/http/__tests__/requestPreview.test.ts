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
})
