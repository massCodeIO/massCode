import type { Folder } from '@@/types/db'

export interface State {
  folders: Folder[]
  selectedId: string | undefined
}
