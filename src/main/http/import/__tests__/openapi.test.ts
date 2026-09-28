import { describe, expect, it } from 'vitest'
import { parseOpenApiFiles } from '../openapi'
import { parsePostmanFiles } from '../postman'

describe('parseOpenApiFiles', () => {
  it('parses OpenAPI YAML operations, security, params, and request bodies', () => {
    const result = parseOpenApiFiles([
      {
        content: `
openapi: 3.0.0
info:
  title: Leader-ID
  version: 1.0.0
servers:
  - url: https://v2api.leader-id.ru
paths:
  /auth/jwt-login?token=raw-token:
    get:
      summary: Login By Token
      parameters:
        - name: token
          in: query
          schema:
            type: string
          example: query-token
      responses:
        '200':
          description: ''
  /events/%7B%7Bid%7D%7D/draft:
    get:
      summary: Draft
      security:
        - draft: []
      responses:
        '200':
          description: ''
  /users/{id}:
    get:
      summary: User Data
      tags:
        - Users
      parameters:
        - name: id
          in: path
          schema:
            type: string
          example: test-user
      responses:
        '200':
          description: ''
  /auth/login:
    post:
      summary: Login
      parameters:
        - name: Content-Type
          in: header
          schema:
            type: string
          example: application/json
      requestBody:
        $ref: '#/components/requestBodies/login'
      responses:
        '200':
          description: ''
components:
  requestBodies:
    login:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/login'
  schemas:
    login:
      type: object
      properties:
        email:
          type: string
        password:
          type: string
  securitySchemes:
    draft:
      type: http
      scheme: bearer
`,
        name: 'leader-id.yaml',
      },
    ])

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0]).toEqual(
      expect.objectContaining({
        name: 'Leader-ID',
      }),
    )
    expect(result.collections[0].folders).toEqual([
      expect.objectContaining({ name: 'Users', parentId: null }),
    ])
    expect(result.collections[0].requests).toEqual([
      expect.objectContaining({
        method: 'GET',
        name: 'Login By Token',
        query: [{ description: undefined, key: 'token', value: 'query-token' }],
        url: 'https://v2api.leader-id.ru/auth/jwt-login',
      }),
      expect.objectContaining({
        auth: { token: '{{draft}}', type: 'bearer' },
        method: 'GET',
        name: 'Draft',
        url: 'https://v2api.leader-id.ru/events/{{id}}/draft',
      }),
      expect.objectContaining({
        folderId: 'tag:Users',
        method: 'GET',
        name: 'User Data',
        url: 'https://v2api.leader-id.ru/users/{{id}}',
      }),
      expect.objectContaining({
        body: JSON.stringify({ email: '', password: '' }, null, 2),
        bodyType: 'json',
        headers: [
          {
            description: undefined,
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
        method: 'POST',
        name: 'Login',
        url: 'https://v2api.leader-id.ru/auth/login',
      }),
    ])
    expect(result.environments).toEqual([
      {
        name: 'Leader-ID Examples',
        variables: {
          draft: '',
          id: 'test-user',
        },
      },
    ])
  })

  it('parses OpenAPI JSON files', () => {
    const result = parseOpenApiFiles([
      {
        content: JSON.stringify({
          info: { title: 'JSON API', version: '1.0.0' },
          openapi: '3.0.0',
          paths: {
            '/ping': {
              get: {
                responses: { 200: { description: '' } },
                summary: 'Ping',
              },
            },
          },
        }),
        name: 'json-api.json',
      },
    ])

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].requests).toEqual([
      expect.objectContaining({
        method: 'GET',
        name: 'Ping',
        url: '/ping',
      }),
    ])
  })

  it('does not make Postman parser warn on OpenAPI JSON', () => {
    const result = parsePostmanFiles([
      {
        content: JSON.stringify({
          info: { title: 'JSON API', version: '1.0.0' },
          openapi: '3.0.0',
          paths: {},
        }),
        name: 'openapi.json',
      },
    ])

    expect(result.warnings).toEqual([])
  })
})
