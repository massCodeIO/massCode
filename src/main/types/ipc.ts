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

type DBAction =
  | 'relaod'
  | 'move'
  | 'migrate'
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
type PrettierAction = 'format'
type FsAction = 'assets'

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type DBChannel = CombineWith<DBAction, 'db'>
export type SystemChannel = CombineWith<SystemAction, 'system'>
export type PrettierChannel = CombineWith<PrettierAction, 'prettier'>
export type FsChannel = CombineWith<FsAction, 'fs'>

export type Channel =
  | MainMenuChannel
  | DBChannel
  | SystemChannel
  | PrettierChannel
  | FsChannel

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
