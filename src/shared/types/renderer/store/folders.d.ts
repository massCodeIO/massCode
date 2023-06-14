import type { SystemFolderAlias } from '@shared/types/renderer/sidebar'
import type { Folder, FolderTree } from '@shared/types/main/db'

export interface State {
  folders: Folder[]
  foldersTree: FolderTree[]
  selected?: FolderTree
  selectedId?: string
  selectedContextId?: string
  selectedIds?: string[]
  selectedAlias?: SystemFolderAlias
  hoveredId?: string
}
