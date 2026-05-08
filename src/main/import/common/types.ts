export type ImportSource =
  | 'github-gists'
  | 'raycast-snippets'
  | 'vscode-snippets'

export interface ImportWarning {
  message: string
  source: string
}

export interface ImportFile {
  content: string
  encoding?: 'text' | 'base64'
  name: string
  relativePath?: string
}

export interface ImportPayload {
  files?: ImportFile[]
  url?: string
}

export interface SnippetImportContent {
  label: string
  language: string
  value: string
}

export interface SnippetImportCandidate {
  contents: SnippetImportContent[]
  description?: string | null
  folderPath?: string[]
  name: string
  sourceId?: string
  sourceUrl?: string
  tags?: string[]
}

export interface SnippetImportParseResult {
  snippets: SnippetImportCandidate[]
  warnings: ImportWarning[]
}

export interface ImportPreview {
  folders: Array<{
    path: string
    snippets: number
  }>
  groups: Array<{
    name: string
    snippets: number
  }>
  snippets: number
  source: ImportSource
  tags: string[]
  warnings: ImportWarning[]
}

export interface ImportApplySummary {
  createdRootFolderName: string
  createdSnippetNames: string[]
  folders: number
  snippets: number
  source: ImportSource
  tags: number
  warnings: ImportWarning[]
}
