import type { OpenDialogOptions } from 'electron'

export type CombineWith<T extends string, U extends string> = `${U}:${T}`

type MainMenuAction =
  | 'add-description'
  | 'copy-note'
  | 'copy-snippet'
  | 'find'
  | 'font-size-decrease'
  | 'font-size-increase'
  | 'font-size-reset'
  | 'format'
  | 'goto-preferences'
  | 'goto-devtools'
  | 'new-note'
  | 'new-note-folder'
  | 'new-task'
  | 'new-folder'
  | 'new-fragment'
  | 'new-sheet'
  | 'new-snippet'
  | 'navigate-back'
  | 'navigate-forward'
  | 'open-dialog'
  | 'preview-mindmap'
  | 'preview-code'
  | 'preview-json'
  | 'presentation-mode'
  | 'set-content-sort-field'
  | 'set-content-sort-order'
  | 'set-layout-mode'
  | 'set-notes-editor-mode'
  | 'send-http-request'
  | 'toggle-sidebar'
  | 'toggle-compact-mode'
  | 'toggle-hide-completed-tasks'
  | 'update-context'
  | 'goto-math-notebook'

type DBAction = 'migrate-to-markdown'

type SystemAction =
  | 'activate-license'
  | 'api-token-generate'
  | 'api-token-revoke'
  | 'currency-rates'
  | 'currency-rates-refresh'
  | 'crypto-rates-refresh'
  | 'get-directory-state'
  | 'reload'
  | 'move-vault'
  | 'set-vault-path'
  | 'open-external'
  | 'show-http-request-in-file-manager'
  | 'show-notes-folder-in-file-manager'
  | 'show-note-in-file-manager'
  | 'show-snippet-in-file-manager'
  | 'deep-link'
  | 'install-update'
  | 'update-available'
  | 'update-downloaded'
  | 'renderer-ready'
  | 'storage-synced'
  | 'cloud-download-status'
  | 'cloud-download-progress'
  | 'migration-complete'
  | 'migration-error'
  | 'error'
type PrettierAction = 'format'
type FsAction = 'assets' | 'import-markdown-folder' | 'notes-asset'
type ThemeAction = 'list' | 'get' | 'open-dir' | 'create-template' | 'changed'
type SpacesAction =
  | 'math:read'
  | 'math:write'
  | 'http:execute'
  | 'drawings:list'
  | 'drawings:read'
  | 'drawings:write'
  | 'drawings:create'
  | 'drawings:rename'
  | 'drawings:duplicate'
  | 'drawings:delete'

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type DBChannel = CombineWith<DBAction, 'db'>
export type SystemChannel = CombineWith<SystemAction, 'system'>
export type PrettierChannel = CombineWith<PrettierAction, 'prettier'>
export type FsChannel = CombineWith<FsAction, 'fs'>
export type ThemeChannel = CombineWith<ThemeAction, 'theme'>
export type SpacesChannel = CombineWith<SpacesAction, 'spaces'>

export type Channel =
  | MainMenuChannel
  | DBChannel
  | SystemChannel
  | PrettierChannel
  | FsChannel
  | ThemeChannel
  | SpacesChannel

export interface DialogOptions {
  properties?: OpenDialogOptions['properties']
  filters?: OpenDialogOptions['filters']
}

export interface PrettierOptions {
  text: string
  parser: string
}

export interface FsAssetsOptions {
  path: string
}

export interface ImportMarkdownFolderFile {
  content: string
  name: string
  relativePath: string
}

export interface ImportMarkdownFolderWarning {
  code: string
  details?: Record<string, string>
  source: string
}

export interface ImportMarkdownFolderResponse {
  canceled: boolean
  files: ImportMarkdownFolderFile[]
  warnings: ImportMarkdownFolderWarning[]
}
