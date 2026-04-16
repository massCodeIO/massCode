import type { OpenDialogOptions } from 'electron'

export type CombineWith<T extends string, U extends string> = `${U}:${T}`

type MainMenuAction =
  | 'add-description'
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
  | 'set-layout-mode'
  | 'set-notes-editor-mode'
  | 'toggle-sidebar'
  | 'toggle-compact-mode'
  | 'update-context'
  | 'goto-math-notebook'

type DBAction = 'migrate-to-markdown'

type SystemAction =
  | 'currency-rates'
  | 'currency-rates-refresh'
  | 'crypto-rates-refresh'
  | 'get-directory-state'
  | 'reload'
  | 'move-vault'
  | 'open-external'
  | 'show-notes-folder-in-file-manager'
  | 'show-note-in-file-manager'
  | 'deep-link'
  | 'update-available'
  | 'renderer-ready'
  | 'storage-synced'
  | 'migration-complete'
  | 'migration-error'
  | 'error'
type PrettierAction = 'format'
type FsAction = 'assets' | 'notes-asset'
type ThemeAction = 'list' | 'get' | 'open-dir' | 'create-template' | 'changed'
type SpacesAction = 'math:read' | 'math:write'

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
