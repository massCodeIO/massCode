import { describe, expect, it } from 'vitest'
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
        auth: { token: '{{token}}', type: 'bearer' },
        method: 'GET',
        name: 'List users',
        query: [{ key: 'page', value: '1' }],
        url: '{{baseUrl}}/users',
      }),
    ])
    expect(result.environments).toEqual([
      {
        name: 'API Variables',
        variables: { baseUrl: 'https://api.example.com' },
      },
    ])
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
