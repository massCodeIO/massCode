import type { OpenDialogOptions } from 'electron'

export type CombineWith<T extends string, U extends string> = `${U}:${T}`

type MainMenuAction = 'goto-preferences' | 'open-dialog'
type DBAction = 'relaod' | 'move' | 'migrate' | 'clear'
type SystemAction = 'reload'

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type DBChannel = CombineWith<DBAction, 'db'>
export type SystemChannel = CombineWith<SystemAction, 'system'>

export type Channel = MainMenuChannel | DBChannel | SystemChannel

export interface DialogOptions {
  properties?: OpenDialogOptions['properties']
  filters?: OpenDialogOptions['filters']
}
