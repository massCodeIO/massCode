import { RouterName } from '@/router'

export function getVisibleSelectedFolderIds(
  routeName: string | null | undefined,
  selectedFolderIds: number[],
) {
  if (routeName !== RouterName.notesSpace) {
    return []
  }

  return selectedFolderIds
}

export function shouldHandleFolderClick(
  routeName: string | null | undefined,
  currentFolderId: number | undefined,
  targetFolderId: number,
  selectedCount: number,
) {
  return (
    routeName !== RouterName.notesSpace
    || currentFolderId !== targetFolderId
    || selectedCount > 1
  )
}
