export type ImportSource =
  | 'github-gists'
  | 'obsidian'
  | 'raycast-snippets'
  | 'snippetslab'
  | 'vscode-snippets'

export type ImportSpace = 'code' | 'notes'

export interface ImportWarning {
  code: string
  details?: Record<string, string>
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
  space?: ImportSpace
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
  notes: number
  snippets: number
  source: ImportSource
  tags: string[]
  warnings: ImportWarning[]
}

export interface ImportApplySummary {
  createdRootFolderName: string
  createdSnippetNames: string[]
  folders: number
  notes: number
  snippets: number
  source: ImportSource
  tags: number
  warnings: ImportWarning[]
}

export interface NoteImportCandidate {
  content: string
  folderPath?: string[]
  name: string
  sourceId?: string
  tags?: string[]
}

export interface NoteImportParseResult {
  notes: NoteImportCandidate[]
  warnings: ImportWarning[]
}
