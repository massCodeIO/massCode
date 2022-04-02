import type { SystemFolderAlias } from '@/components/sidebar/types'
import type { Folder, FolderTree } from '@@/types/db'

export interface State {
  folders: Folder[]
  foldersTree: FolderTree[]
  selected?: FolderTree
  selectedId?: string
  selectedIds?: string[]
  selectedAlias?: SystemFolderAlias
}
