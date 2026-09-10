import type { HttpRuntime, HttpRuntimeResult } from '../../shared/httpRuntime'
import type { HttpScriptResult } from '../../shared/httpScripts'

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export type HttpBodyType =
  | 'none'
  | 'json'
  | 'graphql'
  | 'text'
  | 'form-urlencoded'
  | 'multipart'
  | 'binary'

export type HttpAuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey'

export interface HttpHeaderEntry {
  key: string
  value: string
  description?: string
  enabled?: boolean
}

export interface HttpQueryEntry {
  key: string
  value: string
  description?: string
  enabled?: boolean
}

export interface HttpFormDataEntry {
  enabled?: boolean
  description?: string
  key: string
  type: 'text' | 'file'
  value: string
}

export interface HttpAuth {
  key?: string
  value?: string
  in?: 'header' | 'query'
  type: HttpAuthType
  token?: string
  username?: string
  password?: string
}

export interface HttpExecuteRequest {
  method: HttpMethod
  url: string
  headers: HttpHeaderEntry[]
  query: HttpQueryEntry[]
  bodyType: HttpBodyType
  body: string | null
  formData: HttpFormDataEntry[]
  auth: HttpAuth
}

export interface HttpExecutePayload {
  request: HttpExecuteRequest
  runtime?: HttpRuntime
  requestId: number | null
  environmentId: number | null
  skipCertificateVerification?: boolean
  timeoutMs?: number
  transport?: import('../../shared/httpTransport').HttpTransport
}

export interface HttpSecretPayload {
  environmentId: number
  key: string
}

export interface HttpSecretSetPayload extends HttpSecretPayload {
  value: string
}

export type HttpSecretMutationError =
  | 'invalidKey'
  | 'notFound'
  | 'unavailable'
  | 'unknown'

export interface HttpSecretMutationResult {
  ok: boolean
  error?: HttpSecretMutationError
}

export type HttpResponseBodyKind = 'text' | 'json' | 'binary'

export interface HttpExecuteResult {
  graphql?: import('../../shared/httpGraphql').GraphqlResponseState
  scriptResults?: HttpScriptResult[]
  runtimeResults?: {
    extractions: HttpRuntimeResult[]
    assertions: HttpRuntimeResult[]
  }
  sessionNames?: string[]
  discarded?: boolean
  status: number | null
  statusText: string
  headers: HttpHeaderEntry[]
  body: string
  bodyKind: HttpResponseBodyKind
  durationMs: number
  sizeBytes: number
  truncated: boolean
  error?: string
}
