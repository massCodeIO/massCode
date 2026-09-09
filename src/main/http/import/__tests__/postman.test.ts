import { describe, expect, it } from 'vitest'
import { buildHttpFormBody } from '../../../../shared/httpForm'
import { buildGraphqlBody } from '../../../../shared/httpGraphql'
import { parsePostmanFiles } from '../postman'

describe('parsePostmanFiles', () => {
  it('parses nested Postman collection requests and inherited auth', () => {
    const result = parsePostmanFiles([
      {
        content: JSON.stringify({
          auth: {
            bearer: [{ key: 'token', value: '{{token}}' }],
            type: 'bearer',
          },
          info: {
            name: 'API',
            schema:
              'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              item: [
                {
                  name: 'List users',
                  request: {
                    header: [{ key: 'Accept', value: 'application/json' }],
                    method: 'GET',
                    url: {
                      raw: '{{baseUrl}}/users?active=true',
                      query: [{ key: 'page', value: '1' }],
                    },
                  },
                },
              ],
              name: 'Users',
            },
          ],
          variable: [{ key: 'baseUrl', value: 'https://api.example.com' }],
        }),
        name: 'api.postman_collection.json',
      },
    ])

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].folders).toEqual([
      expect.objectContaining({ name: 'Users', parentId: null }),
    ])
    expect(result.collections[0].requests).toEqual([
      expect.objectContaining({
        auth: { type: 'inherit' },
        method: 'GET',
        name: 'List users',
        query: [{ key: 'page', value: '1' }],
        url: '{{baseUrl}}/users',
      }),
    ])
    expect(result.environments).toEqual([])
    expect(result.collections[0].collectionConfig).toMatchObject({
      auth: { type: 'bearer', token: '{{token}}' },
      variables: [{ key: 'baseUrl', value: 'https://api.example.com' }],
    })
  })

  it('keeps explicit Authorization header over inherited auth', () => {
    const result = parsePostmanFiles([
      {
        content: JSON.stringify({
          auth: {
            bearer: [{ key: 'token', value: '{{token}}' }],
            type: 'bearer',
          },
          info: {
            name: 'API',
            schema:
              'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Auth header',
              request: {
                header: [{ key: 'Authorization', value: 'Bearer explicit' }],
                method: 'GET',
                url: 'https://api.example.com',
              },
            },
          ],
        }),
        name: 'api.postman_collection.json',
      },
    ])

    expect(result.collections[0].requests[0].auth).toEqual({ type: 'none' })
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        message: 'Authorization header kept; imported auth helper skipped',
      }),
    )
  })

  it('parses Postman environment and skips disabled variables', () => {
    const result = parsePostmanFiles([
      {
        content: JSON.stringify({
          _postman_variable_scope: 'environment',
          name: 'Local',
          values: [
            { key: 'token', value: 'secret' },
            { enabled: false, key: 'disabled', value: 'nope' },
          ],
        }),
        name: 'local.postman_environment.json',
      },
    ])

    expect(result.environments).toEqual([
      { name: 'Local', variables: { token: 'secret' } },
    ])
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        message: 'Disabled variable "disabled" skipped',
      }),
    )
  })

  it('ignores non-JSON files without warnings', () => {
    const result = parsePostmanFiles([
      {
        content: 'info:\n  name: Bruno\n',
        name: 'opencollection.yml',
      },
    ])

    expect(result).toEqual({
      collections: [],
      environments: [],
      warnings: [],
    })
  })
})

function parseRequestBody(body: unknown) {
  return parsePostmanFiles([
    {
      name: 'qa.json',
      content: JSON.stringify({
        info: {
          name: 'QA',
          schema:
            'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: { method: 'POST', url: 'https://example.com', body },
          },
        ],
      }),
    },
  ])
}

describe('postman roundtrip regressions', () => {
  it('encodes form keys and values without losing repeated, empty or templated values', () => {
    const result = parseRequestBody({
      mode: 'urlencoded',
      urlencoded: [
        { key: 'special', value: 'a&b=c+d%' },
        { key: 'a&= +%', value: 'Привет мир' },
        { key: 'tag', value: 'one' },
        { key: 'tag', value: 'two' },
        { key: 'empty', value: '' },
        { key: 'variable', value: '{{ value }}' },
        { key: 'disabled', value: 'ignored', disabled: true },
      ],
    })
    const request = result.collections[0].requests[0]
    expect(request.body).toBeNull()
    expect(request.formData.at(-1)).toMatchObject({
      key: 'disabled',
      enabled: false,
    })
    const body = buildHttpFormBody(request.body, request.formData)
    expect([...new URLSearchParams(body)]).toEqual([
      ['special', 'a&b=c+d%'],
      ['a&= +%', 'Привет мир'],
      ['tag', 'one'],
      ['tag', 'two'],
      ['empty', ''],
      ['variable', '{{ value }}'],
    ])
    expect(
      request.formData.find(entry => entry.key === 'variable')?.value,
    ).toBe('{{ value }}')
  })

  it.each(['{"id":"qa-1"}', '', '  ', { id: 'qa-1' }])(
    'converts GraphQL variables %j to an object',
    (variables) => {
      const result = parseRequestBody({
        mode: 'graphql',
        graphql: { query: 'query { user { id } }', variables },
      })
      expect(result.collections[0].requests[0].bodyType).toBe('graphql')
      expect(
        JSON.parse(buildGraphqlBody(result.collections[0].requests[0].body!)),
      ).toEqual({
        query: 'query { user { id } }',
        variables:
          typeof variables === 'string' && !variables.trim()
            ? {}
            : { id: 'qa-1' },
      })
    },
  )

  it.each(['{invalid', '{{variables}}', '[]', 'null', '42'])(
    'preserves invalid GraphQL variables %s with a warning',
    (variables) => {
      const result = parseRequestBody({
        mode: 'graphql',
        graphql: { query: 'query { id }', variables },
      })
      expect(
        JSON.parse(result.collections[0].requests[0].body!).variables,
      ).toBe(variables)
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: 'spaces.http.import.runtimeWarnings.graphqlVariables',
        }),
      )
    },
  )

  it('retains Markdown and object descriptions at all supported levels, including disabled entries', () => {
    const result = parsePostmanFiles([
      {
        name: 'qa.json',
        content: JSON.stringify({
          info: {
            name: 'QA',
            schema: 'postman',
            description: '# Roundtrip QA\n\nMarkdown',
          },
          item: [
            {
              name: 'Folder',
              description: { content: 'Folder documentation: **QA**.' },
              item: [
                {
                  name: 'GET',
                  request: {
                    method: 'GET',
                    description: { content: 'Request **docs**' },
                    header: [
                      {
                        key: 'Accept',
                        value: 'application/json',
                        description: 'Expected format',
                      },
                      {
                        key: 'X-Off',
                        value: 'off',
                        disabled: true,
                        description: { content: 'Disabled header' },
                      },
                    ],
                    url: {
                      raw: 'https://example.com',
                      query: [
                        {
                          key: 'search',
                          value: 'hello',
                          description: 'Search description',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        }),
      },
    ])
    const collection = result.collections[0]
    expect(collection.description).toBe('# Roundtrip QA\n\nMarkdown')
    expect(collection.folders[0].description).toBe(
      'Folder documentation: **QA**.',
    )
    expect(collection.requests[0].description).toBe('Request **docs**')
    expect(collection.requests[0].headers[0].description).toBe(
      'Expected format',
    )
    expect(collection.requests[0].headers[1]).toMatchObject({
      enabled: false,
      description: 'Disabled header',
    })
    expect(collection.requests[0].query[0].description).toBe(
      'Search description',
    )
  })
})

it('imports binary paths and API keys without discarding an explicit Authorization header', () => {
  const result = parsePostmanFiles([
    {
      name: 'binary.json',
      content: JSON.stringify({
        info: { name: 'QA', schema: 'postman' },
        item: [
          {
            name: 'Binary',
            request: {
              method: 'POST',
              url: 'https://example.test',
              auth: {
                type: 'apikey',
                apikey: [
                  { key: 'key', value: 'X-Key' },
                  { key: 'value', value: '{{token}}' },
                  { key: 'in', value: 'header' },
                ],
              },
              header: [{ key: 'Authorization', value: 'custom' }],
              body: { mode: 'file', file: { src: '/local/file.bin' } },
            },
          },
        ],
      }),
    },
  ])
  expect(result.collections[0].requests[0]).toMatchObject({
    bodyType: 'binary',
    body: '/local/file.bin',
    auth: { type: 'apikey', key: 'X-Key', value: '{{token}}', in: 'header' },
    headers: [{ key: 'Authorization', value: 'custom' }],
  })
})
