import type {
  HttpAuth,
  HttpBodyType,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpMethod,
  HttpQueryEntry,
} from '../../types/http'

export interface HttpImportWarning {
  source: string
  message: string
}

export interface HttpImportFolder {
  id: string
  parentId: string | null
  name: string
}

export interface HttpImportRequest {
  sourceId?: string
  folderId: string | null
  name: string
  method: HttpMethod
  url: string
  headers: HttpHeaderEntry[]
  query: HttpQueryEntry[]
  bodyType: HttpBodyType
  body: string | null
  formData: HttpFormDataEntry[]
  auth: HttpAuth
  description?: string
}

export interface HttpImportCollection {
  name: string
  description?: string
  folders: HttpImportFolder[]
  requests: HttpImportRequest[]
}

export interface HttpImportEnvironment {
  name: string
  variables: Record<string, string>
}

export interface HttpImportResult {
  collections: HttpImportCollection[]
  environments: HttpImportEnvironment[]
  warnings: HttpImportWarning[]
}

export interface HttpImportPersistSummary {
  collections: number
  folders: number
  requests: number
  environments: number
  createdCollectionNames: string[]
  warnings: HttpImportWarning[]
}

export interface HttpImportFile {
  name: string
  content: string
  encoding?: 'text' | 'base64'
}

export interface HttpImportSelection {
  selectedCollectionIndexes?: number[]
  selectedEnvironmentIndexes?: number[]
}

export interface HttpImportPreview {
  collections: Array<{
    index: number
    name: string
    folders: number
    requests: number
  }>
  environments: Array<{
    index: number
    name: string
    variables: number
  }>
  warnings: HttpImportWarning[]
}
