import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { parseOpenCollectionFiles } from '../opencollection'
import { expandZipFiles } from '../zip'

describe('parseOpenCollectionFiles', () => {
  it('parses Bruno OpenCollection YAML folders, requests, and environments', () => {
    const result = parseOpenCollectionFiles([
      {
        content: `
info:
  name: Store API
`,
        name: 'store/opencollection.yml',
      },
      {
        content: `
info:
  name: Users
  type: folder
`,
        name: 'store/users/folder.yml',
      },
      {
        content: `
info:
  name: Get User
  type: http

http:
  method: GET
  url: https://api.example.com/users/:id
  params:
    - name: id
      value: "{{userId}}"
      type: path
    - name: active
      value: "true"
      type: query
  headers:
    - name: Accept
      value: application/json
  auth:
    type: bearer
    token: "{{token}}"

runtime:
  scripts:
    - type: before-request
      code: console.log("skip")

docs: Get one user.
`,
        name: 'store/users/get-user.yml',
      },
      {
        content: `
info:
  name: Local
variables:
  baseUrl: http://localhost:3000
  token: local-token
`,
        name: 'store/environments/local.yml',
      },
    ])

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].name).toBe('Store API')
    expect(result.collections[0].folders).toEqual([
      expect.objectContaining({ id: 'users', name: 'Users', parentId: null }),
    ])
    expect(result.collections[0].requests).toEqual([
      expect.objectContaining({
        auth: { token: '{{token}}', type: 'bearer' },
        description: 'Get one user.',
        folderId: 'users',
        headers: [{ key: 'Accept', value: 'application/json' }],
        method: 'GET',
        name: 'Get User',
        query: [{ key: 'active', value: 'true' }],
        url: 'https://api.example.com/users/{{id}}',
      }),
    ])
    expect(result.environments).toEqual([
      {
        name: 'Local',
        variables: {
          baseUrl: 'http://localhost:3000',
          token: 'local-token',
        },
      },
    ])
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ message: 'Runtime scripts skipped' }),
    )
  })

  it('expands Bruno OpenCollection ZIP files without importing archive folders', async () => {
    const zip = new JSZip()
    zip.file(
      'bruno-shop/opencollection.yml',
      `
info:
  name: Bruno Shop
`,
    )
    zip.file(
      'bruno-shop/orders/folder.yml',
      `
info:
  name: Orders
  type: folder
`,
    )
    zip.file(
      'bruno-shop/orders/list.yml',
      `
info:
  name: List Orders
  type: http

http:
  method: GET
  url: "{{baseUrl}}/orders"
`,
    )

    const expandedFiles = await expandZipFiles([
      {
        content: await zip.generateAsync({ type: 'base64' }),
        encoding: 'base64',
        name: 'bruno-shop.zip',
      },
    ])
    const result = parseOpenCollectionFiles(expandedFiles)

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].name).toBe('Bruno Shop')
    expect(result.collections[0].folders).toEqual([
      expect.objectContaining({ id: 'orders', name: 'Orders', parentId: null }),
    ])
    expect(result.collections[0].requests).toEqual([
      expect.objectContaining({
        folderId: 'orders',
        method: 'GET',
        name: 'List Orders',
        url: '{{baseUrl}}/orders',
      }),
    ])
  })

  it('keeps separate Bruno ZIP roots as separate collections', async () => {
    const firstZip = new JSZip()
    firstZip.file('first/opencollection.yml', 'info:\n  name: First\n')
    firstZip.file(
      'first/ping.yml',
      'info:\n  name: Ping\n  type: http\nhttp:\n  method: GET\n  url: https://first.example.com\n',
    )

    const secondZip = new JSZip()
    secondZip.file('second/opencollection.yml', 'info:\n  name: Second\n')
    secondZip.file(
      'second/ping.yml',
      'info:\n  name: Ping\n  type: http\nhttp:\n  method: GET\n  url: https://second.example.com\n',
    )

    const result = parseOpenCollectionFiles(
      await expandZipFiles([
        {
          content: await firstZip.generateAsync({ type: 'base64' }),
          encoding: 'base64',
          name: 'first.zip',
        },
        {
          content: await secondZip.generateAsync({ type: 'base64' }),
          encoding: 'base64',
          name: 'second.zip',
        },
      ]),
    )

    expect(result.collections).toEqual([
      expect.objectContaining({ name: 'First' }),
      expect.objectContaining({ name: 'Second' }),
    ])
    expect(
      result.collections.map(collection => collection.requests[0].url),
    ).toEqual(['https://first.example.com', 'https://second.example.com'])
  })

  it('parses Bruno bundled single-file YAML exports', () => {
    const result = parseOpenCollectionFiles([
      {
        content: `
opencollection: 1.0.0
info:
  name: Leader-ID
items:
  - info:
      name: City
      type: http
      seq: 7
    http:
      method: GET
      url: https://v2api.leader-id.ru/cities/search?q=ekaterinburg
      params:
        - name: q
          value: ekaterinburg
          type: query
      auth: inherit
  - info:
      name: Draft
      type: http
    http:
      method: GET
      url: https://v2api.leader-id.ru/events/{{id}}/draft
      auth:
        type: bearer
        token: local-token
    runtime:
      scripts:
        - type: before-request
          code: bru.setGlobalEnvVar("id", "39121");
`,
        name: 'Leader-ID.yml',
      },
    ])

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0]).toEqual(
      expect.objectContaining({
        folders: [],
        name: 'Leader-ID',
      }),
    )
    expect(result.collections[0].requests).toEqual([
      expect.objectContaining({
        auth: { type: 'none' },
        method: 'GET',
        name: 'City',
        query: [{ key: 'q', value: 'ekaterinburg' }],
        url: 'https://v2api.leader-id.ru/cities/search',
      }),
      expect.objectContaining({
        auth: { token: 'local-token', type: 'bearer' },
        method: 'GET',
        name: 'Draft',
        url: 'https://v2api.leader-id.ru/events/{{id}}/draft',
      }),
    ])
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ message: 'Runtime scripts skipped' }),
    )
  })
})
