import { normalizeFlag } from '../normalizers'
import { buildFolderPathMap } from './folderIndex'

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

interface FolderIdByPathSyncable {
  folderIdByPath?: Record<string, number>
  folders: {
    id: number
    name: string
    orderIndex: number
    parentId: number | null
  }[]
}

// Персистируемый fallback path → folder id: сами folders в state.json не
// хранятся (источник истины — .meta.yaml каталогов), но при недокачанном
// .meta.yaml scan иначе чеканил бы папке новый id на каждом холодном старте,
// а записи со старым folderId выглядели бы пропавшими. Пустой список папок
// (provisional-кэш) не затирает сохранённую карту.
export function syncFolderIdByPathWithFolders(
  state: FolderIdByPathSyncable,
): void {
  if (!state.folders.length) {
    return
  }

  const nextFolderIdByPath: Record<string, number> = {}
  buildFolderPathMap(state.folders).forEach((folderPath, folderId) => {
    nextFolderIdByPath[folderPath] = folderId
  })

  state.folderIdByPath = nextFolderIdByPath
}
