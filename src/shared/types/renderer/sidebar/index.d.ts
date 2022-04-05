import type { Folder } from '@shared/types/main/db'
import type { FunctionalComponent } from 'vue'

export type Tab = 'library' | 'tags'
export type SystemFolderAlias = 'inbox' | 'favorites' | 'trash' | 'all'

export interface Tabs {
  label: string
  value: Tab
}

export interface SidebarSystemFolder extends Partial<Folder> {
  icon: FunctionalComponent
  alias: SystemFolderAlias
}
