import type { Folder, Snippet } from '@shared/types/main/db'

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
  isContextState: boolean
  isMarkdownPreview: boolean
}
