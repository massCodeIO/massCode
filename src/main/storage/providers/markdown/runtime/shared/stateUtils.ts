import { normalizeFlag } from '../normalizers'

interface FolderUiSyncable {
  folders: { id: number, isOpen: number }[]
  folderUi: Record<string, { isOpen: number }>
}

export function syncFolderUiWithFolders(state: FolderUiSyncable): void {
  const nextFolderUi: Record<string, { isOpen: number }> = {}

  state.folders.forEach((folder) => {
    const isOpen = normalizeFlag(folder.isOpen)
    folder.isOpen = isOpen
    nextFolderUi[String(folder.id)] = { isOpen }
  })

  state.folderUi = nextFolderUi
}
