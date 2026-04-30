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

export interface HttpRequestFrontmatter {
  id?: number
  name?: string
  folderId?: number | null
  method?: HttpMethod
  url?: string
  headers?: HttpHeaderEntry[]
  query?: HttpQueryEntry[]
  bodyType?: HttpBodyType
  body?: string | null
  formData?: HttpFormDataEntry[]
  auth?: HttpAuth
  createdAt?: number
  updatedAt?: number
}

export interface HttpFolderRecord {
  id: number
  name: string
  parentId: number | null
  isOpen: number
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export interface HttpFolderTreeRecord extends HttpFolderRecord {
  children: HttpFolderTreeRecord[]
}

export interface HttpRequestIndexItem {
  id: number
  filePath: string
}

export interface HttpRequestRecord {
  id: number
  name: string
  folderId: number | null
  method: HttpMethod
  url: string
  headers: HttpHeaderEntry[]
  query: HttpQueryEntry[]
  bodyType: HttpBodyType
  body: string | null
  formData: HttpFormDataEntry[]
  auth: HttpAuth
  description: string
  filePath: string
  createdAt: number
  updatedAt: number
}

export interface HttpEnvironmentRecord {
  id: number
  name: string
  variables: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface HttpHistoryRecord {
  id: number
  requestId: number | null
  method: HttpMethod
  url: string
  status: number | null
  durationMs: number
  sizeBytes: number
  requestedAt: number
  error?: string
}

export interface HttpCounters {
  folderId: number
  requestId: number
  environmentId: number
  historyId: number
}

export interface HttpStateFile {
  version?: number
  counters?: Partial<HttpCounters>
  folders?: HttpFolderRecord[]
  requests?: HttpRequestIndexItem[]
  environments?: HttpEnvironmentRecord[]
  activeEnvironmentId?: number | null
  history?: HttpHistoryRecord[]
}

export interface HttpState {
  version: number
  counters: HttpCounters
  folders: HttpFolderRecord[]
  requests: HttpRequestIndexItem[]
  environments: HttpEnvironmentRecord[]
  activeEnvironmentId: number | null
  history: HttpHistoryRecord[]
}

export interface HttpPaths {
  httpRoot: string
  statePath: string
}

export interface HttpRuntimeCache {
  paths: HttpPaths
  state: HttpState
  requestById: Map<number, HttpRequestRecord>
  folderById: Map<number, HttpFolderRecord>
}
