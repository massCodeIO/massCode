interface Folder {
  id: string
  name: string
  defaultLanguage: string | null
  parentId: string | null
  isOpen: boolean
  isSystem: boolean
  index: number
  createdAt: number
  updatedAt: number
  icon: string | null
}

interface SnippetContent {
  label: string
  value: string
  language: string
}

interface Snippet {
  id: string
  name: string
  content: SnippetContent[]
  description: string | null
  folderId: string
  tagsIds: string[]
  isDeleted: boolean
  isFavorites: boolean
  createdAt: number
  updatedAt: number
}

interface Tag {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface JSONDB {
  folders: Folder[]
  snippets: Snippet[]
  tags: Tag[]
}

export interface Backup {
  name: string
  path: string
  size: number
  createdAt: Date
}
