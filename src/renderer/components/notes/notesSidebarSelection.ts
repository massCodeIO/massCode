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
