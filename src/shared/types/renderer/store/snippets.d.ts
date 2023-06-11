import type { Folder, Snippet, SnippetsSort } from '@shared/types/main/db'

export interface SnippetWithFolder extends Snippet {
  folder: Folder
}

export interface State {
  all: SnippetWithFolder[]
  snippets: SnippetWithFolder[]
  selected?: Snippet
  selectedMultiple: Snippet[]
  fragment: number
  searchQuery?: string
  sort: SnippetsSort
  hideSubfolderSnippets: boolean
  compactMode: boolean
  isContextState: boolean
  isMarkdownPreview: boolean
  isScreenshotPreview: boolean
  isCodePreview: boolean
}
