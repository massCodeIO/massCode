import type { Folder, FolderTree } from '@@/types/db'

export interface State {
  folders: Folder[]
  foldersTree: FolderTree[]
  selectedId: string | undefined
}
