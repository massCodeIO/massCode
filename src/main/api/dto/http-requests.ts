import Elysia, { t } from 'elysia'
import { commonQuery } from './common/query'

const httpMethod = t.Union([
  t.Literal('GET'),
  t.Literal('POST'),
  t.Literal('PUT'),
  t.Literal('PATCH'),
  t.Literal('DELETE'),
  t.Literal('HEAD'),
  t.Literal('OPTIONS'),
])

const httpBodyType = t.Union([
  t.Literal('none'),
  t.Literal('json'),
  t.Literal('graphql'),
  t.Literal('text'),
  t.Literal('form-urlencoded'),
  t.Literal('multipart'),
  t.Literal('binary'),
])

const httpAuthType = t.Union([
  t.Literal('inherit'),
  t.Literal('none'),
  t.Literal('bearer'),
  t.Literal('apikey'),
  t.Literal('basic'),
])

const httpHeaderEntry = t.Object({
  key: t.String(),
  value: t.String(),
  description: t.Optional(t.String()),
  enabled: t.Optional(t.Boolean()),
})

const httpQueryEntry = t.Object({
  key: t.String(),
  value: t.String(),
  description: t.Optional(t.String()),
  enabled: t.Optional(t.Boolean()),
})

const httpFormDataEntry = t.Object({
  enabled: t.Optional(t.Boolean()),
  description: t.Optional(t.String()),
  key: t.String(),
  type: t.Union([t.Literal('text'), t.Literal('file')]),
  value: t.String(),
})

const httpAuth = t.Object({
  type: httpAuthType,
  key: t.Optional(t.String()),
  value: t.Optional(t.String()),
  in: t.Optional(t.Union([t.Literal('header'), t.Literal('query')])),
  token: t.Optional(t.String()),
  username: t.Optional(t.String()),
  password: t.Optional(t.String()),
})

const httpRequestsAdd = t.Object({
  name: t.String(),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  protocol: t.Optional(t.Union([t.Literal('http'), t.Literal('websocket')])),
  method: t.Optional(httpMethod),
  url: t.Optional(t.String()),
})

const httpRequestsUpdate = t.Object({
  name: t.Optional(t.String()),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  isDeleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  isFavorites: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  protocol: t.Optional(t.Union([t.Literal('http'), t.Literal('websocket')])),
  method: t.Optional(httpMethod),
  url: t.Optional(t.String()),
  headers: t.Optional(t.Array(httpHeaderEntry)),
  query: t.Optional(t.Array(httpQueryEntry)),
  bodyType: t.Optional(httpBodyType),
  body: t.Optional(t.Union([t.String(), t.Null()])),
  formData: t.Optional(t.Array(httpFormDataEntry)),
  auth: t.Optional(httpAuth),
  description: t.Optional(t.String()),
})

export const httpRuntime = t.Object({
  transport: t.Optional(
    t.Object({
      timeoutMs: t.Optional(
        t.Number({ multipleOf: 1, minimum: 0, maximum: 2147483647 }),
      ),
      maxResponseBytes: t.Optional(
        t.Number({
          multipleOf: 1,
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        }),
      ),
      protocolVersion: t.Optional(
        t.Union([t.Literal('http1'), t.Literal('auto'), t.Literal('http2')]),
      ),
      encodeUrl: t.Optional(t.Boolean()),
      followOriginalHttpMethod: t.Optional(t.Boolean()),
      followAuthorizationHeader: t.Optional(t.Boolean()),
      removeRefererHeaderOnRedirect: t.Optional(t.Boolean()),
      followRedirects: t.Optional(t.Boolean()),
      maxRedirects: t.Optional(
        t.Number({ multipleOf: 1, minimum: 0, maximum: 100 }),
      ),
      skipCertificateVerification: t.Optional(t.Boolean()),
    }),
  ),
  scripts: t.Optional(
    t.Object({
      preRequest: t.String({ maxLength: 65536 }),
      postResponse: t.String({ maxLength: 65536 }),
    }),
  ),
  version: t.Union([t.Literal(1), t.Literal(2)]),
  extractions: t.Array(
    t.Object({
      name: t.String(),
      source: t.Union([t.Literal('json'), t.Literal('header')]),
      path: t.String(),
    }),
    { maxItems: 100 },
  ),
  assertions: t.Array(
    t.Object({
      name: t.String(),
      source: t.Union([
        t.Literal('json'),
        t.Literal('header'),
        t.Literal('status'),
        t.Literal('durationMs'),
      ]),
      path: t.Optional(t.String()),
      operator: t.Union([
        t.Literal('eq'),
        t.Literal('neq'),
        t.Literal('exists'),
        t.Literal('contains'),
        t.Literal('gt'),
        t.Literal('gte'),
        t.Literal('lt'),
        t.Literal('lte'),
        t.Literal('notContains'),
        t.Literal('startsWith'),
        t.Literal('endsWith'),
        t.Literal('matches'),
        t.Literal('notMatches'),
        t.Literal('length'),
        t.Literal('between'),
        t.Literal('in'),
        t.Literal('notIn'),
        t.Literal('isString'),
        t.Literal('isNumber'),
        t.Literal('isBoolean'),
        t.Literal('isArray'),
        t.Literal('isObject'),
        t.Literal('isNull'),
      ]),
      expected: t.Optional(
        t.Union([
          t.String(),
          t.Number(),
          t.Boolean(),
          t.Null(),
          t.Array(t.Union([t.String(), t.Number(), t.Boolean(), t.Null()]), {
            maxItems: 1000,
          }),
        ]),
      ),
    }),
    { maxItems: 100 },
  ),
})

const httpRequestItem = t.Object({
  runtimeRevision: t.Union([t.String(), t.Null()]),
  runtime: t.Union([httpRuntime, t.Null()]),
  runtimeState: t.Union([
    t.Literal('ready'),
    t.Literal('pending'),
    t.Literal('invalid'),
    t.Literal('unsupported'),
  ]),
  id: t.Number(),
  name: t.String(),
  folderId: t.Union([t.Number(), t.Null()]),
  protocol: t.Optional(t.Union([t.Literal('http'), t.Literal('websocket')])),
  method: httpMethod,
  url: t.String(),
  headers: t.Array(httpHeaderEntry),
  query: t.Array(httpQueryEntry),
  bodyType: httpBodyType,
  body: t.Union([t.String(), t.Null()]),
  formData: t.Array(httpFormDataEntry),
  auth: httpAuth,
  description: t.String(),
  filePath: t.String(),
  isFavorites: t.Number(),
  isDeleted: t.Number(),
  pendingCloudDownload: t.Optional(t.Boolean()),
  createdAt: t.Number(),
  updatedAt: t.Number(),
})

// Список не сериализует body: полная запись выбранного запроса загружается
// через GET /http-requests/:id, а тела остаются ленивыми на диске до
// первого обращения. description лежит в metadata-индексе и отдаётся
// списком (совместимость с клиентами v5.8).
const httpRequestListItem = t.Object({
  id: t.Number(),
  name: t.String(),
  folderId: t.Union([t.Number(), t.Null()]),
  protocol: t.Optional(t.Union([t.Literal('http'), t.Literal('websocket')])),
  method: httpMethod,
  url: t.String(),
  headers: t.Array(httpHeaderEntry),
  query: t.Array(httpQueryEntry),
  bodyType: httpBodyType,
  formData: t.Array(httpFormDataEntry),
  auth: httpAuth,
  description: t.String(),
  filePath: t.String(),
  isFavorites: t.Number(),
  isDeleted: t.Number(),
  pendingCloudDownload: t.Optional(t.Boolean()),
  createdAt: t.Number(),
  updatedAt: t.Number(),
})

const httpRequestsResponse = t.Array(httpRequestListItem)

const httpRequestsQuery = t.Object({
  ...commonQuery.properties,
  searchNameOnly: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  folderId: t.Optional(t.Number()),
  isFavorites: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  isDeleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  isInbox: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
})

export const httpRequestsDTO = new Elysia().model({
  httpRuntime,
  httpRuntimeSave: t.Object({
    runtime: httpRuntime,
    expectedRevision: t.String(),
  }),
  httpRuntimeSaveResponse: t.Object({ runtimeRevision: t.String() }),
  httpRequestItemResponse: httpRequestItem,
  httpRequestsAdd,
  httpRequestsQuery,
  httpRequestsResponse,
  httpRequestsUpdate,
})

export type HttpRequestsAdd = typeof httpRequestsAdd.static
export type HttpRequestsUpdate = typeof httpRequestsUpdate.static
export type HttpRequestsResponse = typeof httpRequestsResponse.static
export type HttpRequestItemResponse = typeof httpRequestItem.static
