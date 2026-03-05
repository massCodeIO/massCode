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
  | 'new-folder'
  | 'new-fragment'
  | 'new-snippet'
  | 'open-dialog'
  | 'preview-markdown'
  | 'preview-mindmap'
  | 'preview-code'
  | 'preview-json'
  | 'presentation-mode'
  | 'toggle-sidebar'

type DBAction =
  | 'relaod'
  | 'move'
  | 'migrate'
  | 'migrate-to-markdown'
  | 'migrate-to-sqlite'
  | 'clear'
  | 'backup'
  | 'restore'
  | 'delete-backup'
  | 'backup-list'
  | 'start-auto-backup'
  | 'stop-auto-backup'
  | 'move-backup'

type SystemAction =
  | 'reload'
  | 'open-external'
  | 'deep-link'
  | 'update-available'
  | 'feature-notice'
  | 'renderer-ready'
  | 'storage-synced'
  | 'error'
type PrettierAction = 'format'
type FsAction = 'assets'
type ThemeAction = 'list' | 'get' | 'open-dir' | 'create-template' | 'changed'

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type DBChannel = CombineWith<DBAction, 'db'>
export type SystemChannel = CombineWith<SystemAction, 'system'>
export type PrettierChannel = CombineWith<PrettierAction, 'prettier'>
export type FsChannel = CombineWith<FsAction, 'fs'>
export type ThemeChannel = CombineWith<ThemeAction, 'theme'>

export type Channel =
  | MainMenuChannel
  | DBChannel
  | SystemChannel
  | PrettierChannel
  | FsChannel
  | ThemeChannel

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
