import type {
  HttpAuth,
  HttpBodyType,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpMethod,
  HttpQueryEntry,
} from '../../../../../types/http'

export type {
  HttpAuth,
  HttpAuthType,
  HttpBodyType,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpMethod,
  HttpQueryEntry,
} from '../../../../../types/http'

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
  isDeleted?: number
  isFavorites?: number
  createdAt?: number
  updatedAt?: number
}

export interface HttpFolderRecord {
  id: number
  name: string
  icon: string | null
  parentId: number | null
  isOpen: number
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export interface HttpFolderTreeRecord extends HttpFolderRecord {
  children: HttpFolderTreeRecord[]
}

// Денормализованные метаданные списка в .state.yaml (слой 4 плана
// icloud-lazy-vault-load): всё, кроме body и description, чтобы строить
// записи без чтения файлов. mtimeMs/size — freshness-сигнатура последнего
// чтения: пока stat совпадает, файл не перечитывается.
export interface HttpRequestIndexMetadata {
  auth: HttpAuth
  bodyType: HttpBodyType
  createdAt: number
  formData: HttpFormDataEntry[]
  headers: HttpHeaderEntry[]
  isDeleted: number
  isFavorites: number
  method: HttpMethod
  mtimeMs: number
  name: string
  query: HttpQueryEntry[]
  size: number
  updatedAt: number
  url: string
}

export interface HttpRequestIndexItem {
  id: number
  filePath: string
  meta?: HttpRequestIndexMetadata
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
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
  /**
   * Runtime-only: body и description ещё не дочитаны из файла (запись
   * построена из индекса метаданных). Снимается ensureRequestDetailsLoaded;
   * наружу через API не отдаётся — все выдающие потоки материализуют.
   */
  detailsPending?: boolean
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
  // Дефолтный state на период, пока .state.yaml не докачан из облака:
  // такой state нельзя ни персистить, ни использовать для выдачи id.
  provisional?: boolean
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
