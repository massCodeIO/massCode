import type { Folder, Snippet } from '@@/types/db'

export interface SnippetWithFolder extends Snippet {
  folder: Folder
}

export interface State {
  all: SnippetWithFolder[]
  snippets: SnippetWithFolder[]
  snippet: Snippet | undefined
  fragment: number
}
