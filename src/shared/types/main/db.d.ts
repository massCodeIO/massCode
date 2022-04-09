// import type { Language } from '../renderer/editor'
import type { Language } from '@shared/types/renderer/editor'

export interface Folder {
  id: string
  name: string
  defaultLanguage: Language
  parentId: string | null
  isOpen: boolean
  isSystem: boolean
  createdAt: number
  updatedAt: number
}

export interface FolderTree extends Folder {
  children: Folder[]
}

export interface SnippetContent {
  label: string
  language: Language
  value: string
}

export interface Snippet {
  id: string
  name: string
  content: SnippetContent[]
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
