import type { Language } from '@shared/types/renderer/editor'
import type { FunctionalComponent } from 'vue'

export interface Folder {
  id: string
  name: string
  defaultLanguage: Language
  parentId: string | null
  icon?: string | null | FunctionalComponent
  isOpen: boolean
  isSystem: boolean
  createdAt: number
  updatedAt: number
}

export interface FolderTree extends Folder {
  children: Folder[]
}

export type SnippetsSort = 'updatedAt' | 'createdAt' | 'name'

export interface SnippetContent {
  label: string
  language: Language
  value: string
}

export interface Snippet {
  id: string
  name: string
  content: SnippetContent[]
  description?: string | null
  folderId: string
  tagsIds: string[]
  isFavorites: boolean
  isDeleted: boolean
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface DB {
  folders: Folder[]
  snippets: Snippet[]
  tags: Tag[]
}
