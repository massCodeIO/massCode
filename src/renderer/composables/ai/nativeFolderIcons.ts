import type { NativeBridgeResult } from './nativeBridges'
import type { TaskMutation } from './taskUndo'
import type { FolderIconChangeResult } from '~/main/types/ipc'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import {
  getFilteredFolderIcons,
  resolveFolderIcon,
} from '@/components/ui/folder-icon/icons'
import { useHttpFolders } from '@/composables/spaces/http/useHttpFolders'
import { useNoteFolders } from '@/composables/spaces/notes/useNoteFolders'
import { useFolders } from '@/composables/useFolders'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'

function refreshFolders(space: 'code' | 'notes' | 'http') {
  return space === 'code'
    ? useFolders().getFolders(false)
    : space === 'notes'
      ? useNoteFolders().getNoteFolders(false)
      : useHttpFolders().getHttpFolders(false)
}
export async function executeFolderIconAction(
  action: Extract<AiNativeAction, { action: 'readFolderIcons' | 'folderIcon' }>,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  if (!current())
    return { status: 'stale' }
  if (action.action === 'readFolderIcons') {
    const icons = getFilteredFolderIcons(action.query)
    return {
      status: 'done',
      icons: icons
        .slice(action.offset, action.offset + 100)
        .map(({ name, value }) => ({ name, value })),
      total: icons.length,
    }
  }
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  if (
    action.choice.kind === 'icon'
    && action.choice.value !== null
    && !action.choice.value.startsWith('emoji:')
    && !resolveFolderIcon(action.choice.value)
  ) {
    return { status: 'unavailable' }
  }
  const result = await ipc.invoke<unknown, FolderIconChangeResult>(
    'fs:folder-icon:change',
    {
      vault,
      spaceId: action.space,
      folderId: action.folderId,
      ...(action.choice.kind === 'image'
        ? { chooseImage: true }
        : { icon: action.choice.value }),
    },
  )
  if (result.status !== 'done')
    return result
  const mutation: Extract<TaskMutation, { kind: 'folderIcon' }> = {
    kind: 'folderIcon',
    id: result.receiptId,
    vault,
    space: action.space,
  }
  markPersistedStorageMutation()
  const refreshed
    = vault === store.preferences.get('storage.vaultPath')
      && (await refreshFolders(action.space))
  return { status: refreshed ? 'done' : 'failed', persisted: true, mutation }
}
export async function undoNativeFolderIcon(
  receipt: Extract<TaskMutation, { kind: 'folderIcon' }>,
) {
  if (receipt.vault !== store.preferences.get('storage.vaultPath'))
    return ['folderIcon']
  const result = await ipc.invoke<{ id: string }, { undone: boolean }>(
    'fs:folder-icon:undo',
    { id: receipt.id },
  )
  if (!result.undone)
    return ['folderIcon']
  receipt.undone = true
  markPersistedStorageMutation()
  return (await refreshFolders(receipt.space)) ? [] : ['folderIconRefresh']
}
