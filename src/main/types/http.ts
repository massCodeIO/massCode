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
  | 'text'
  | 'form-urlencoded'
  | 'multipart'

export type HttpAuthType = 'none' | 'bearer' | 'basic'

export interface HttpHeaderEntry {
  key: string
  value: string
}

export interface HttpQueryEntry {
  key: string
  value: string
}

export interface HttpFormDataEntry {
  key: string
  type: 'text' | 'file'
  value: string
}

export interface HttpAuth {
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
  requestId: number | null
  environmentId: number | null
  timeoutMs?: number
}

export type HttpResponseBodyKind = 'text' | 'json' | 'binary'

export interface HttpExecuteResult {
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
